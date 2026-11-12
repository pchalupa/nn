import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { ID } from "@nn/id";
import { array, number, object, string } from "@nn/schema";
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

		store.onChange(listener);
		store.update((draft) => {
			draft.language = "cs";
		});

		expect(listener).toHaveBeenCalledOnce();
	});

	it("creates an inferred store from a schema", () => {
		const store = new Store(ticketsSchema);

		expectTypeOf(store).toEqualTypeOf<Store<typeof ticketsSchema>>();
		expectTypeOf(store.read().tickets).toEqualTypeOf<ReadonlyArray<{ readonly title: string }>>();
		expect(store.read()).toStrictEqual({ tickets: [], language: "" });
	});

	it("exposes the schema it was built from", () => {
		const store = new Store(ticketsSchema);

		expect(store.schema).toBe(ticketsSchema);
		expectTypeOf(store.schema).toEqualTypeOf<typeof ticketsSchema>();
	});

	it("passes every changed field, encoded, in one call", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.onChange(listener);
		store.update((draft) => {
			draft.language = "cs";
			draft.tickets.push({ title: "A" });
		});

		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0][0]).toStrictEqual({
			language: store.encode().data.language,
			tickets: store.encode().data.tickets,
		});
	});

	it("merges an encoded field from another store and reports it", () => {
		const remote = new Store(ticketsSchema);
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		remote.update((draft) => {
			draft.language = "cs";
		});
		store.onChange(listener);
		store.merge("language", remote.encode().data.language);

		expect(store.read().language).toBe("cs");
		expect(Object.keys(listener.mock.calls[0][0])).toStrictEqual(["language"]);
	});

	it("doesn't encode changes until a listener reads them", () => {
		const store = new Store(ticketsSchema);
		const encode = vi.spyOn(Codec.prototype, "encode");
		const listener = vi.fn();

		store.onChange(listener);
		store.update((draft) => {
			draft.language = "cs";
		});

		expect(Object.keys(listener.mock.calls[0][0])).toStrictEqual(["language"]);
		expect(encode).not.toHaveBeenCalled();

		const changes = listener.mock.calls[0][0];

		expect(changes.language).toBe(changes.language);
		expect(encode).toHaveBeenCalledOnce();
	});

	it("throws when merging a value that can't be decoded", () => {
		expect(() => new Store(ticketsSchema).merge("language", { nope: true })).toThrow("Invalid encoded entity.");
	});

	it("ignores a merge into an unknown field or with another field's value", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.onChange(listener);
		store.merge("missing", store.encode().data.language);
		store.merge("language", store.encode().data.tickets);

		expect(listener).not.toHaveBeenCalled();
		expect(store.read()).toStrictEqual({ tickets: [], language: "" });
	});

	it("exposes neither State nor the old channels", () => {
		expectTypeOf<Store>().not.toHaveProperty("state");
		expectTypeOf<Store>().not.toHaveProperty("changes");
		expectTypeOf<Store>().not.toHaveProperty("updates");
	});

	it("stops reporting to an observer after it unsubscribes", () => {
		const store = new Store(ticketsSchema);
		const observer = vi.fn();

		store.onChange(observer)();
		store.update((draft) => {
			draft.language = "cs";
		});

		expect(observer).not.toHaveBeenCalled();
	});

	it("does not report no-op or thrown updates to observers", () => {
		const store = new Store(ticketsSchema);
		const observer = vi.fn();

		store.onChange(observer);
		store.update(() => {});
		expect(() =>
			store.update((draft) => {
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");

		expect(observer).not.toHaveBeenCalled();
	});

	it("reads and updates nested fields through root drafts", () => {
		const store = new Store(object({ settings: object({ theme: string() }) }));

		store.update((draft) => {
			draft.settings.theme = "dark";
		});
		expect(store.read()).toStrictEqual({ settings: { theme: "dark" } });
	});

	it("publishes one update for a collection recipe and skips no-ops", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.onChange(listener);
		store.update((draft) => {
			draft.tickets.push({ title: "First" }, { title: "Second" });
		});
		store.update((draft) => {
			draft.tickets[0].title = "Changed";
		});
		store.update(() => {});
		expect(store.read().tickets).toStrictEqual([{ title: "Changed" }, { title: "Second" }]);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("sets and clears a string through assignments", () => {
		const store = new Store(ticketsSchema);

		store.update((draft) => {
			draft.language = "cs";
		});
		expect(store.read().language).toBe("cs");
		store.update((draft) => {
			draft.language = "";
		});
		expect(store.read().language).toBe("");
	});

	it("calls every listener when one unsubscribes during notification", () => {
		const store = new Store(ticketsSchema);
		const second = vi.fn();
		const unsubscribe = store.onChange(() => unsubscribe());

		store.onChange(second);
		store.update((draft) => {
			draft.language = "cs";
		});

		expect(second).toHaveBeenCalledOnce();
	});

	it("does not report or publish any part of a thrown update", () => {
		const store = new Store(ticketsSchema);
		const before = store.read();
		const listener = vi.fn();
		const observer = vi.fn();

		store.onChange(listener);
		store.onChange(observer);
		expect(() =>
			store.update((draft) => {
				draft.tickets.push({ title: "Valid" });
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");
		expect(store.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
		expect(observer).not.toHaveBeenCalled();
	});

	it("applies edits made before a failure and still publishes them", () => {
		const shape = object({ first: string(), rows: array(object({ tags: array(string()) })) });
		const store = new Store(shape);
		const listener = vi.fn();
		const observer = vi.fn();

		store.onChange(listener);
		store.onChange(observer);

		const create = ID.create;

		let allocations = 0;

		vi.spyOn(ID, "create").mockImplementation(() => {
			if (++allocations === 2) throw new Error("id unavailable");

			return create();
		});
		expect(() =>
			store.update((draft) => {
				draft.first = "edited";
				draft.rows.push({ tags: ["new"] });
			}),
		).toThrow("id unavailable");
		expect(store.read().first).toBe("edited");
		expect(listener).toHaveBeenCalledOnce();
		expect(observer).toHaveBeenCalledOnce();
		expect(Object.keys(observer.mock.calls[0][0])).toContain("first");
	});

	it("does not notify after unsubscribing", () => {
		const store = new Store(ticketsSchema);
		const listener = vi.fn();

		store.onChange(listener)();
		store.update((draft) => {
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

			if (!(decoded instanceof RGA)) throw new TypeError("Expected a decoded collection.");

			restored.merge(decoded);

			expect(now).not.toHaveBeenCalled();
			expect(restored.encode()).toStrictEqual(saved);
		});
	});

	describe("merging data saved by another schema", () => {
		const comment = object({ body: string(), author: string() });
		const current = object({ tickets: array(object({ title: string(), comments: array(comment) })) });

		it("fills a field added after the row was saved", () => {
			const older = new Store(object({ tickets: array(object({ title: string() })) }));
			const store = new Store(current);

			older.update((draft) => {
				draft.tickets.push({ title: "Old" });
			});
			store.merge("tickets", older.encode().data.tickets);

			expect(store.read().tickets).toStrictEqual([{ title: "Old", comments: [] }]);
		});

		it("fills a field missing from a nested row", () => {
			const older = new Store(
				object({ tickets: array(object({ title: string(), comments: array(object({ body: string() })) })) }),
			);
			const store = new Store(current);

			older.update((draft) => {
				draft.tickets.push({ title: "Old", comments: [{ body: "Hi" }] });
			});
			store.merge("tickets", older.encode().data.tickets);

			expect(store.read().tickets).toStrictEqual([{ title: "Old", comments: [{ body: "Hi", author: "" }] }]);
		});

		it("keeps fields the schema does not declare on a new row", () => {
			const newer = new Store(
				object({ tickets: array(object({ title: string(), comments: array(comment), priority: number() })) }),
			);
			const store = new Store(current);

			newer.update((draft) => {
				draft.tickets.push({ title: "New", comments: [], priority: 2 });
			});
			store.merge("tickets", newer.encode().data.tickets);

			expect(store.encode()).toMatchObject({
				data: { tickets: { data: [{ data: { priority: { data: 2 } } }] } },
			});
		});

		it("keeps every row when a nested field changed kind", () => {
			const older = new Store(object({ tickets: array(object({ title: string(), comments: string() })) }));
			const store = new Store(current);

			older.update((draft) => {
				draft.tickets.push({ title: "First", comments: "none" }, { title: "Second", comments: "none" });
			});
			store.merge("tickets", older.encode().data.tickets);

			expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Second"]);
		});

		it("keeps local values when an older copy of the same row arrives", () => {
			const store = new Store(current);
			const older = Time.now();
			const row = createReconciliationStrategy(current.properties.tickets.items, new WeakMap()).create(
				{ title: "New", comments: [{ body: "Hi", author: "Ann" }] },
				"t1",
			);
			const stale = new LWWMap({ title: new LWWRegister("Stale", "title", older) }, "t1");

			store.merge("tickets", new RGA([row], "tickets").encode());
			store.merge("tickets", new RGA([stale], "tickets").encode());

			expect(store.read().tickets).toStrictEqual([{ title: "New", comments: [{ body: "Hi", author: "Ann" }] }]);
		});
	});
});
