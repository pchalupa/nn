import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import { RGA } from "@nn/entities/kinds/rga";
import { ID } from "@nn/id";
import { array, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createReconciliationStrategy } from "./reconciliation/create-strategy";
import { Store } from "./store";

const ticket = object({ title: string() });

const ticketsSchema = object({ tickets: array(ticket), language: string() });

describe("Store", () => {
	afterEach(() => vi.restoreAllMocks());

	it("notifies listeners without a repository", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.updates.subscribe(listener);
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(listener).toHaveBeenCalledOnce();
	});

	it("creates an inferred store from a schema", () => {
		const store = new Store(ticketsSchema);

		expectTypeOf(store).toEqualTypeOf<Store<typeof ticketsSchema>>();
		expectTypeOf(store.state.read().tickets).toEqualTypeOf<ReadonlyArray<{ readonly title: string }>>();
		expect(store.state.read()).toStrictEqual({ tickets: [], language: "" });
	});

	it("exposes the schema it was built from", () => {
		const store = new Store(ticketsSchema);

		expect(store.schema).toBe(ticketsSchema);
		expectTypeOf(store.schema).toEqualTypeOf<typeof ticketsSchema>();
	});

	it("reports the changed entities to every observer before listeners", () => {
		const store = new Store(ticketsSchema);
		const order: string[] = [];
		const first = vi.fn((changed: ReadonlySet<Entity>) =>
			order.push(`first:${[...changed].map((entity) => entity.key).join(",")}`),
		);
		const second = vi.fn(() => order.push("second"));

		store.changes.subscribe(first);
		store.changes.subscribe(second);
		store.updates.subscribe(() => order.push("listener"));
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" });
			draft.language = "cs";
		});

		expect(order).toStrictEqual(["first:tickets,language", "second", "listener"]);
	});

	it("stops reporting to an observer after it unsubscribes", () => {
		const store = new Store(ticketsSchema);
		const observer = vi.fn();

		store.changes.subscribe(observer)();
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(observer).not.toHaveBeenCalled();
	});

	it("does not report no-op or thrown updates to observers", () => {
		const store = new Store(ticketsSchema);
		const observer = vi.fn();

		store.changes.subscribe(observer);
		store.state.update(() => {});
		expect(() =>
			store.state.update((draft) => {
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");

		expect(observer).not.toHaveBeenCalled();
	});

	it("reads and updates nested fields through root drafts", () => {
		const store = new Store(object({ settings: object({ theme: string() }) }));

		store.state.update((draft) => {
			draft.settings.theme = "dark";
		});
		expect(store.state.read()).toStrictEqual({ settings: { theme: "dark" } });
	});

	it("publishes one update for a collection recipe and skips no-ops", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.updates.subscribe(listener);
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" }, { title: "Second" });
		});
		store.state.update((draft) => {
			draft.tickets[0].title = "Changed";
		});
		store.state.update(() => {});
		expect(store.state.read().tickets).toStrictEqual([{ title: "Changed" }, { title: "Second" }]);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("sets and clears a string through assignments", () => {
		const store = new Store(ticketsSchema);

		store.state.update((draft) => {
			draft.language = "cs";
		});
		expect(store.state.read().language).toBe("cs");
		store.state.update((draft) => {
			draft.language = "";
		});
		expect(store.state.read().language).toBe("");
	});

	it("calls every listener when one unsubscribes during notification", () => {
		const store = new Store(ticketsSchema);
		const second = vi.fn();
		const unsubscribe = store.updates.subscribe(() => unsubscribe());

		store.updates.subscribe(second);
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(second).toHaveBeenCalledOnce();
	});

	it("does not report or publish any part of a thrown update", () => {
		const store = new Store(ticketsSchema);
		const before = store.state.read();
		const listener = vi.fn();
		const observer = vi.fn();

		store.updates.subscribe(listener);
		store.changes.subscribe(observer);
		expect(() =>
			store.state.update((draft) => {
				draft.tickets.push({ title: "Valid" });
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");
		expect(store.state.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
		expect(observer).not.toHaveBeenCalled();
	});

	it("applies edits made before a failure and still publishes them", () => {
		const shape = object({ first: string(), rows: array(object({ tags: array(string()) })) });
		const store = new Store(shape);
		const listener = vi.fn();
		const observer = vi.fn();

		store.updates.subscribe(listener);
		store.changes.subscribe(observer);

		const create = ID.create;

		let allocations = 0;

		vi.spyOn(ID, "create").mockImplementation(() => {
			if (++allocations === 2) throw new Error("id unavailable");

			return create();
		});
		expect(() =>
			store.state.update((draft) => {
				draft.first = "edited";
				draft.rows.push({ tags: ["new"] });
			}),
		).toThrow("id unavailable");
		expect(store.state.read().first).toBe("edited");
		expect(listener).toHaveBeenCalledOnce();
		expect(observer).toHaveBeenCalledOnce();
		expect([...observer.mock.calls[0][0]].map((entity) => entity.key)).toContain("first");
	});

	it("does not notify after unsubscribing", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.updates.subscribe(listener)();
		store.state.update((draft) => {
			draft.language = "cs";
		});
		expect(listener).not.toHaveBeenCalled();
	});

	describe("persistence format", () => {
		it("encodes a collection as rows of field entities with their timestamps", () => {
			const rows = new RGA(
				[createReconciliationStrategy(ticket, new WeakMap()).create({ title: "A" }, "row-1")],
				"tickets",
			);

			expect(rows.encode()).toMatchObject({
				metadata: { kind: "RGA" },
				data: [
					{
						key: "row-1",
						metadata: { kind: "LWWMap" },
						data: {
							title: {
								data: "A",
								metadata: { kind: "LWWRegister", timestamp: expect.not.stringMatching(/^1970-/) },
							},
						},
					},
				],
			});
		});

		it("round-trips a captured tree through restore without minting timestamps", () => {
			const saved = new RGA(
				[createReconciliationStrategy(ticket, new WeakMap()).create({ title: "A" }, "row-1")],
				"tickets",
			).encode();
			const now = vi.spyOn(Time, "now");
			const restored = new RGA<Entity>([], "tickets");
			const decoded = new Codec().decode(saved);

			if (!(decoded instanceof RGA)) throw new Error("Expected a decoded collection.");

			restored.merge(decoded);

			expect(now).not.toHaveBeenCalled();
			expect(restored.encode()).toStrictEqual(saved);
		});
	});
});
