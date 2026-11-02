import type { Encoded } from "@nn/entities/Codable";
import { Codec } from "@nn/entities/Codec";
import type { Entity } from "@nn/entities/Entity";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { ID } from "@nn/id";
import type { Repository } from "@nn/repository";
import { array, boolean, number, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createReconciliationStrategy } from "./reconciliation/createStrategy";
import { State } from "./State";
import { Store } from "./Store";

const ticket = object({ title: string() });

const ticketsSchema = object({ tickets: array(ticket), language: string() });

const repositoryMock = (entries: Record<string, unknown> = {}): Repository => ({
	init: vi.fn().mockResolvedValue(undefined),
	get: vi.fn().mockImplementation(async (name: string) => entries[name]),
	set: vi.fn().mockResolvedValue(undefined),
});

describe("Store", () => {
	afterEach(() => vi.restoreAllMocks());

	it("notifies listeners without a repository", () => {
		const store = new Store(new State(ticketsSchema));
		const listener = vi.fn();

		store.subscribe(listener);
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(listener).toHaveBeenCalledOnce();
	});

	it("creates an inferred store from a state or schema", async () => {
		const direct = new Store(new State(ticketsSchema));
		const created = await Store.fromSchema({ schema: ticketsSchema });

		expectTypeOf(direct).toEqualTypeOf<Store<typeof ticketsSchema>>();
		expectTypeOf(created).toEqualTypeOf<Store<typeof ticketsSchema>>();
		expectTypeOf(created.state.read().tickets).toEqualTypeOf<ReadonlyArray<{ readonly title: string }>>();
		expect(created.state.read()).toStrictEqual({ tickets: [], language: "" });
		expect(direct.state.read()).toStrictEqual(created.state.read());
	});

	it("reads and updates nested fields through root drafts", async () => {
		const store = await Store.fromSchema({ schema: object({ settings: object({ theme: string() }) }) });

		store.state.update((draft) => {
			draft.settings.theme = "dark";
		});
		expect(store.state.read()).toStrictEqual({ settings: { theme: "dark" } });
	});

	it("publishes one update for a collection recipe and skips no-ops", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();

		store.subscribe(listener);
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

	it("sets and clears a string through assignments", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });

		store.state.update((draft) => {
			draft.language = "cs";
		});
		expect(store.state.read().language).toBe("cs");
		store.state.update((draft) => {
			draft.language = "";
		});
		expect(store.state.read().language).toBe("");
	});

	it("calls every listener when one unsubscribes during notification", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const second = vi.fn();
		const unsubscribe = store.subscribe(() => unsubscribe());

		store.subscribe(second);
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(second).toHaveBeenCalledOnce();
	});

	it("persists changed fields before calling listeners", async () => {
		const order: string[] = [];
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		vi.mocked(repository.set).mockImplementation(async () => {
			order.push("persist");
		});
		store.subscribe(() => order.push("listener"));
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(order).toStrictEqual(["persist", "listener"]);
	});

	it("does not notify after unsubscribing", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();

		store.subscribe(listener)();
		store.state.update((draft) => {
			draft.language = "cs";
		});
		expect(listener).not.toHaveBeenCalled();
	});

	it("restores stored scalars from the repository", async () => {
		const stored = new LWWRegister("cs", "language", Time.now()).encode();
		const repository = repositoryMock({ language: stored });
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		expect(repository.init).toHaveBeenCalledWith(ticketsSchema.properties);
		expect(repository.get).toHaveBeenCalledWith("tickets");
		expect(repository.get).toHaveBeenCalledWith("language");
		expect(store.state.read()).toStrictEqual({ tickets: [], language: "cs" });
		expect(repository.set).toHaveBeenCalledExactlyOnceWith("language", stored);
	});

	it("does not write back untouched defaults", async () => {
		const repository = repositoryMock({ language: new LWWRegister("", "language", Time.epoch()).encode() });

		await Store.fromSchema({ schema: ticketsSchema, repository });

		expect(repository.set).not.toHaveBeenCalled();
	});

	it("keeps restoring when a write-back fails", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const repository = repositoryMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		vi.mocked(repository.set).mockRejectedValue(new Error("disk full"));

		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		await vi.waitFor(() => expect(error).toHaveBeenCalled());
		expect(store.state.read().language).toBe("cs");
	});

	it("persists only the changed entry and skips equal assignments", async () => {
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		store.state.update((draft) => {
			draft.language = "cs";
		});
		await new Promise((resolve) => setTimeout(resolve));
		const now = vi.spyOn(Time, "now");

		store.state.update((draft) => {
			draft.language = "cs";
		});
		expect(now).not.toHaveBeenCalled();
		expect(repository.set).toHaveBeenCalledTimes(1);
		store.state.update((draft) => {
			draft.language = "en";
		});
		await new Promise((resolve) => setTimeout(resolve));
		expect(now).toHaveBeenCalledOnce();
		expect(repository.set).toHaveBeenCalledTimes(2);
		expect(repository.set).toHaveBeenLastCalledWith("language", {
			key: "language",
			data: "en",
			metadata: { kind: "LWWRegister", timestamp: expect.any(String) },
		});
	});

	it("persists each changed entry once after a multi-entry batch", async () => {
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });
		const writes = vi.mocked(repository.set).mock.calls;
		const listener = vi.fn();

		store.subscribe(listener);
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" }, { title: "Second" });
			draft.language = "cs";
		});
		expect(listener).toHaveBeenCalledOnce();
		expect(writes.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		await new Promise((resolve) => setTimeout(resolve));
		store.state.update((draft) => {
			draft.tickets[0].title = "Changed";
			draft.tickets.length = 1;
			draft.tickets.push({ title: "Added" });
		});
		expect(writes).toHaveLength(3);
		expect(writes[2][0]).toBe("tickets");

		const initial = new Codec().decode(writes[0][1]);
		const updated = new Codec().decode(writes[2][1]);

		if (!(initial instanceof RGA) || !(updated instanceof RGA)) throw new Error("Expected collection entries.");

		expect(updated.current.map((row) => row.key)).toStrictEqual([initial.current[0].key, expect.any(String)]);
		await new Promise((resolve) => setTimeout(resolve));
		store.state.update((draft) => {
			draft.tickets.length = 0;
		});
		expect(writes[3]).toStrictEqual(["tickets", new RGA([], "tickets").encode()]);
	});

	it("starts writing an idle key while another key is still being written", async () => {
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		vi.mocked(repository.set).mockReturnValue(new Promise(() => {}));
		store.state.update((draft) => {
			draft.language = "cs";
		});
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" });
		});
		expect(vi.mocked(repository.set).mock.calls.map(([name]) => name)).toStrictEqual(["language", "tickets"]);
	});

	it("writes a key again after its previous write failed", async () => {
		const failure = new Error("disk full");
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		vi.mocked(repository.set).mockRejectedValueOnce(failure);
		store.state.update((draft) => {
			draft.language = "a";
		});
		await vi.waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith("Failed to persist Store record.", failure));
		store.state.update((draft) => {
			draft.language = "b";
		});
		await vi.waitFor(() => expect(repository.set).toHaveBeenCalledTimes(2));
		expect(repository.set).toHaveBeenLastCalledWith("language", expect.objectContaining({ data: "b" }));
	});

	it("does not persist or publish any part of a thrown update", async () => {
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });
		const before = store.state.read();
		const listener = vi.fn();

		store.subscribe(listener);
		expect(() =>
			store.state.update((draft) => {
				draft.tickets.push({ title: "Valid" });
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");
		expect(store.state.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
		expect(repository.set).not.toHaveBeenCalled();
	});

	it("persists the same accessor value without reading it twice", async () => {
		const repository = repositoryMock();
		const store = await Store.fromSchema({ schema: object({ first: string(), later: string() }), repository });

		let reads = 0;

		store.state.update((draft) => {
			draft.first = "edited";
			Object.defineProperty(draft, "later", {
				enumerable: true,
				get: () => (++reads === 1 ? "valid" : 42),
			});
		});
		expect(store.state.read()).toStrictEqual({ first: "edited", later: "valid" });
		expect(reads).toBe(1);
		expect(repository.set).toHaveBeenLastCalledWith("later", expect.objectContaining({ data: "valid" }));
	});

	it("applies edits made before a failure and still publishes them", async () => {
		const repository = repositoryMock();
		const shape = object({ first: string(), rows: array(object({ tags: array(string()) })) });
		const store = await Store.fromSchema({ schema: shape, repository });
		const listener = vi.fn();

		store.subscribe(listener);
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
		expect(repository.set).toHaveBeenCalledWith("first", expect.anything());
	});

	it("logs persistence failures and keeps persisting later changes", async () => {
		const failure = new Error("storage unavailable");
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const repository = repositoryMock();
		const store = new Store(new State(object({ first: string(), second: string() })), repository);

		vi.mocked(repository.set).mockImplementation(async (name) => {
			if (name === "first") throw failure;
		});
		store.state.update((draft) => {
			draft.first = "Fails";
			draft.second = "Saved";
		});
		await vi.waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith("Failed to persist Store record.", failure));
		expect(repository.set).toHaveBeenCalledWith("second", expect.objectContaining({ data: "Saved" }));
	});

	it("rejects repository read failures during construction", async () => {
		const failure = new Error("read failed");
		const repository = repositoryMock();

		vi.mocked(repository.get).mockRejectedValue(failure);

		await expect(Store.fromSchema({ schema: ticketsSchema, repository })).rejects.toBe(failure);
		expect(repository.set).not.toHaveBeenCalled();
	});

	it("rejects corrupt persisted entries without writing them back", async () => {
		const repository = repositoryMock({ tickets: {}, language: {} });

		await expect(Store.fromSchema({ schema: ticketsSchema, repository })).rejects.toThrow("Invalid encoded entity.");
		expect(repository.set).not.toHaveBeenCalled();
	});

	describe("persistence", () => {
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

		it("round-trips untouched schema defaults without minting timestamps", async () => {
			const repository = repositoryMock({ language: new LWWRegister("", "language", Time.epoch()).encode() });
			const now = vi.spyOn(Time, "now");
			const { state } = await Store.fromSchema({ schema: ticketsSchema, repository });

			expect(state.read().language).toBe("");
			expect(now).not.toHaveBeenCalled();
		});

		it("restores a captured scalar register without minting timestamps", async () => {
			const repository = repositoryMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
			const now = vi.spyOn(Time, "now");
			const { state } = await Store.fromSchema({ schema: ticketsSchema, repository });

			expect(now).not.toHaveBeenCalled();
			expect(state.read().language).toBe("cs");
		});

		it("restores valid sibling values and timestamps while defaulting new nested fields", async () => {
			const schema = object({ profile: object({ name: string(), score: number(), enabled: boolean() }) });
			const profile: Encoded = {
				key: "profile",
				metadata: { kind: "LWWMap" },
				data: { name: new LWWRegister("Ann", "name", Time.now()).encode() },
			};
			const { state } = await Store.fromSchema({ schema, repository: repositoryMock({ profile }) });

			expect(state.read().profile).toStrictEqual({ name: "Ann", score: 0, enabled: false });
		});

		it("propagates a defect unrelated to the stored shape instead of resetting", async () => {
			const tickets = new RGA(
				[createReconciliationStrategy(ticket, new WeakMap()).create({ title: "A" }, "row-1")],
				"tickets",
			).encode();

			vi.spyOn(RGA.prototype, "merge").mockImplementation(() => {
				throw new Error("boom");
			});

			await expect(
				Store.fromSchema({ schema: ticketsSchema, repository: repositoryMock({ tickets }) }),
			).rejects.toThrow("boom");
		});

		it("round-trips a nested collection through capture and restore", async () => {
			const schema = object({
				board: object({ tickets: array(object({ title: string(), tags: array(string()) })) }),
			});
			const board = createReconciliationStrategy(schema.properties.board, new WeakMap())
				.create({ tickets: [{ title: "First", tags: ["red", "blue"] }] }, "board")
				.encode();
			const now = vi.spyOn(Time, "now");
			const { state } = await Store.fromSchema({ schema, repository: repositoryMock({ board }) });

			expect(now).not.toHaveBeenCalled();
			expect(state.read().board.tickets).toStrictEqual([{ title: "First", tags: ["red", "blue"] }]);
		});

		it("reports edits to rows restored from the repository", async () => {
			const tickets = new RGA(
				[createReconciliationStrategy(ticket, new WeakMap()).create({ title: "First" }, "row-1")],
				"tickets",
			).encode();
			const repository = repositoryMock({ tickets });
			const store = await Store.fromSchema({ schema: ticketsSchema, repository });
			const listener = vi.fn();

			store.subscribe(listener);
			store.state.update((draft) => {
				draft.tickets[0].title = "Changed";
			});

			expect(store.state.read().tickets).toStrictEqual([{ title: "Changed" }]);
			expect(listener).toHaveBeenCalledOnce();
			expect(repository.set).toHaveBeenLastCalledWith("tickets", expect.objectContaining({ key: "tickets" }));
		});

		it("rejects stored entries without an entity kind", async () => {
			const repository = repositoryMock({ language: { key: "language", data: "cs", metadata: {} } });

			await expect(Store.fromSchema({ schema: ticketsSchema, repository })).rejects.toThrow("Invalid encoded entity.");
		});

		it("ignores an entry stored under another key", async () => {
			const repository = repositoryMock({ language: new LWWRegister("cs", "old-random-key", Time.now()).encode() });
			const { state } = await Store.fromSchema({ schema: ticketsSchema, repository });

			expect(state.read().language).toBe("");
		});

		it("rejects an entry of an unknown kind stored under another key", async () => {
			const repository = repositoryMock({
				language: { key: "old-random-key", data: [], metadata: { kind: "collection" } },
			});

			await expect(Store.fromSchema({ schema: ticketsSchema, repository })).rejects.toThrow(
				'Unknown entity kind "collection".',
			);
		});
	});
});
