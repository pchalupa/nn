import type { Encoded } from "@nn/entities/codable";
import { Codec } from "@nn/entities/codec";
import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { ID } from "@nn/id";
import { array, boolean, type InferStateType, number, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { createReconciliationStrategy } from "./reconciliation/create-strategy";
import { Store } from "./store";

const ticket = object({ title: string() });
const ticketsSchema = object({ tickets: array(ticket), language: string() });

const assignedTicket = object({ title: string(), assignee: object({ name: string() }) });
const assignedSchema = object({ tickets: array(assignedTicket), language: string() });

const setup = () => {
	const store = new Store(assignedSchema);

	store.update((draft) => {
		draft.tickets.push({ title: "First", assignee: { name: "Ann" } }, { title: "Second", assignee: { name: "Bob" } });
		draft.language = "en";
	});

	return store;
};

const listen = (store: Pick<Store, "onChange">) => {
	const listener = vi.fn<(changes: Readonly<Record<string, Encoded>>) => void>();

	store.onChange(listener);

	return listener;
};

describe("Store", () => {
	afterEach(() => vi.restoreAllMocks());

	describe("schema", () => {
		it("creates an inferred store from a schema", () => {
			const store = new Store(ticketsSchema);

			expectTypeOf(store).toEqualTypeOf<Store<typeof ticketsSchema>>();
			expect(store.schema).toBe(ticketsSchema);
			expectTypeOf(store.schema).toEqualTypeOf<typeof ticketsSchema>();
			expect(store.read()).toStrictEqual({ tickets: [], language: "" });
		});

		it("initializes every declared shape without minting timestamps", () => {
			const now = vi.spyOn(Time, "now");
			const store = new Store(
				object({ count: number(), enabled: boolean(), settings: object({ theme: string() }), tags: array(string()) }),
			);

			expect(store.read()).toStrictEqual({ count: 0, enabled: false, settings: { theme: "" }, tags: [] });
			expect(now).not.toHaveBeenCalled();
		});

		it("supports an empty schema", () => {
			const store = new Store(object({}));
			const before = store.read();

			store.update(() => {});
			expect(before).toStrictEqual({});
			expect(store.read()).toBe(before);
		});

		it("infers the readonly snapshot and mutable draft from the schema", () => {
			const shape = object({
				language: string(),
				count: number(),
				enabled: boolean(),
				board: object({ tickets: array(object({ title: string(), tags: array(string()) })) }),
			});
			const store = new Store(shape);

			expectTypeOf(store.read()).toEqualTypeOf<{
				readonly language: string;
				readonly count: number;
				readonly enabled: boolean;
				readonly board: {
					readonly tickets: ReadonlyArray<{ readonly title: string; readonly tags: readonly string[] }>;
				};
			}>();
			store.update((draft) => {
				expectTypeOf(draft).toEqualTypeOf<InferStateType<typeof shape>>();
				expectTypeOf<{ title: string }>().not.toExtend<Parameters<typeof draft.board.tickets.push>[0]>();
			});
		});
	});

	describe("reads", () => {
		it("reads the store as schema-shaped data", () => {
			expect(setup().read()).toStrictEqual({
				language: "en",
				tickets: [
					{ title: "First", assignee: { name: "Ann" } },
					{ title: "Second", assignee: { name: "Bob" } },
				],
			});
		});

		it("protects cached snapshots passed to a mutable consumer", () => {
			const store = setup();
			const before = store.read();
			const listener = listen(store);
			const rename = (assignee: { name: string }) => {
				assignee.name = "Changed";
			};

			expect(() => rename(before.tickets[0].assignee)).toThrow(TypeError);
			expect(store.read()).toBe(before);
			expect(store.read().tickets[0].assignee.name).toBe("Ann");
			expect(listener).not.toHaveBeenCalled();
			store.update((draft) => {
				draft.language = "cs";
			});
			expect(store.read().tickets).toBe(before.tickets);
			expect(store.read().tickets[0].assignee.name).toBe("Ann");
			expect(listener).toHaveBeenCalledOnce();
		});

		it("reuses unchanged projections without reading their entities again", () => {
			const store = setup();
			const reads = vi.spyOn(RGA.prototype, "current", "get");
			const before = store.read();

			expect(store.read()).toBe(before);
			expect(reads).toHaveBeenCalledOnce();
			store.update((draft) => {
				draft.language = "cs";
			});
			store.update(() => {});
			reads.mockClear();
			expect(store.read()).not.toBe(before);
			expect(store.read().tickets).toBe(before.tickets);
			expect(reads).not.toHaveBeenCalled();
		});

		it("rebuilds only the items and fields that changed", () => {
			const store = setup();
			const before = store.read();

			store.update((draft) => {
				draft.tickets[0].title = "Changed";
			});
			const after = store.read();

			expect(after.tickets).not.toBe(before.tickets);
			expect(after.tickets[1]).toBe(before.tickets[1]);
			expect(after.tickets[0].assignee).toBe(before.tickets[0].assignee);
			expect(before.tickets[0].title).toBe("First");
		});

		it("preserves an object entry's snapshot when another entry changes", () => {
			const store = new Store(object({ settings: object({ theme: string() }), tickets: array(assignedTicket) }));
			const before = store.read().settings;

			store.update((draft) => {
				draft.tickets.push({ title: "First", assignee: { name: "Ann" } });
			});
			expect(store.read().settings).toBe(before);
		});
	});

	describe("updates", () => {
		it("hands the recipe an independent copy of the current snapshot", () => {
			const store = setup();
			const before = store.read();

			let retained: unknown[] = [];

			store.update((draft) => {
				expect(draft).toStrictEqual(before);
				expect(draft).not.toBe(before);
				expect(draft.tickets).not.toBe(before.tickets);
				expect(draft.tickets[0]).not.toBe(before.tickets[0]);
				expect(draft.tickets[0].assignee).not.toBe(before.tickets[0].assignee);
				draft.tickets[0].assignee.name = "Edited";
				retained = draft.tickets;
			});
			retained.length = 0;
			expect(before.tickets[0].assignee.name).toBe("Ann");
			expect(store.read().tickets).toHaveLength(2);
			expect(store.read().tickets[0].assignee.name).toBe("Edited");
		});

		it("clears a string field", () => {
			const store = setup();

			store.update((draft) => {
				draft.language = "";
			});
			expect(store.read().language).toBe("");
		});

		it("updates primitive fields without structured cloning", () => {
			const store = setup();
			const cloned = vi.spyOn(globalThis, "structuredClone");

			store.update((draft) => {
				draft.tickets[0].title = "Changed";
				draft.language = "cs";
			});
			expect(cloned).not.toHaveBeenCalled();
			expect(store.read().tickets[0].title).toBe("Changed");
		});

		it("removes and appends items while retaining surviving entities", () => {
			const store = setup();
			const before = store.read();

			store.update((draft) => {
				draft.tickets.shift();
				draft.tickets.push({ title: "Third", assignee: { name: "Cy" } });
			});
			expect(store.read().tickets[0]).toBe(before.tickets[1]);
			expect(store.read().tickets.map((item) => item.title)).toStrictEqual(["Second", "Third"]);
			store.update((draft) => {
				draft.tickets.length = 0;
			});
			expect(store.read().tickets).toStrictEqual([]);
		});

		it("tells items apart by identity rather than by value", () => {
			const store = setup();
			const third = () => ({ title: "Third", assignee: { name: "Cy" } });

			store.update((draft) => {
				draft.tickets.push(draft.tickets[0], third(), third());
			});
			expect(store.read().tickets).toHaveLength(4);
		});

		it("recognizes a surviving item from an older snapshot after its projection is rebuilt", () => {
			const store = setup();
			const saved = store.read().tickets[1];

			store.update((draft) => {
				draft.tickets[1].title = "Changed";
			});
			expect(store.read().tickets[1]).not.toBe(saved);
			const assignee = store.read().tickets[1].assignee;

			store.update((draft) => {
				draft.tickets = [saved];
			});
			expect(store.read().tickets[0].assignee).toBe(assignee);
			expect(store.read().tickets).toStrictEqual([saved]);
		});

		it("gives a spread snapshot item a new identity", () => {
			const store = setup();
			const saved = store.read().tickets[0];
			const assignee = saved.assignee;

			store.update((draft) => {
				draft.tickets = [{ ...saved, title: "Changed" }];
			});

			expect(store.read().tickets[0].title).toBe("Changed");
			expect(store.read().tickets[0].assignee).not.toBe(assignee);
		});

		it("gives a snapshot item from another store a new identity", () => {
			const store = setup();
			const foreign = setup().read().tickets[0];
			const assignee = store.read().tickets[0].assignee;

			store.update((draft) => {
				draft.tickets = [foreign];
			});

			expect(store.read().tickets).toStrictEqual([foreign]);
			expect(store.read().tickets[0].assignee).not.toBe(assignee);
		});

		it("treats a reinserted removed snapshot item as a new item", () => {
			const store = setup();
			const saved = store.read().tickets[0];

			store.update((draft) => {
				draft.tickets.length = 0;
			});
			store.update((draft) => {
				draft.tickets.push(saved);
			});
			expect(store.read().tickets).toStrictEqual([saved]);
		});

		it("does not apply or report any part of a thrown update", () => {
			const store = setup();
			const before = store.read();
			const listener = listen(store);

			expect(() =>
				store.update((draft) => {
					draft.tickets.push({ title: "Valid", assignee: { name: "Cy" } });
					draft.language = "cs";
					throw new Error("stop");
				}),
			).toThrow("stop");
			expect(store.read()).toBe(before);
			expect(listener).not.toHaveBeenCalled();
		});

		it("applies and reports edits made before a reconciliation failure", () => {
			const store = new Store(object({ first: string(), items: array(object({ tags: array(string()) })) }));
			const listener = listen(store);
			const create = ID.create;

			let allocations = 0;

			vi.spyOn(ID, "create").mockImplementation(() => {
				if (++allocations === 2) throw new Error("id unavailable");

				return create();
			});
			expect(() =>
				store.update((draft) => {
					draft.first = "edited";
					draft.items.push({ tags: ["new"] });
				}),
			).toThrow("id unavailable");
			expect(store.read().first).toBe("edited");
			expect(listener).toHaveBeenCalledOnce();
			expect(Object.keys(listener.mock.calls[0][0])).toContain("first");
		});

		it.each<{ name: string; recipe: (draft: InferStateType<typeof assignedSchema>) => void }>([
			{ name: "an empty recipe", recipe: () => {} },
			{
				name: "an equal assignment",
				recipe: (draft) => {
					draft.language = "en";
				},
			},
			{
				name: "a filter that removes nothing",
				recipe: (draft) => {
					draft.tickets = draft.tickets.filter((item) => item.title !== "Missing");
				},
			},
			{
				name: "a reorder",
				recipe: (draft) => {
					draft.tickets.reverse();
				},
			},
			{
				name: "a wrong-typed collection",
				recipe: (draft) => {
					Reflect.set(draft, "tickets", "oops");
				},
			},
		])("ignores $name", ({ recipe }) => {
			const store = setup();
			const before = store.read();
			const listener = listen(store);

			store.update(recipe);
			expect(store.read()).toBe(before);
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("draft edits", () => {
		const item = (title = "First") => ({ title, assignee: { name: "Ann", key: "data" }, tags: ["one"] });

		const setupItems = (...titles: string[]) => {
			const store = new Store(
				object({
					language: string(),
					tickets: array(
						object({ title: string(), assignee: object({ name: string(), key: string() }), tags: array(string()) }),
					),
				}),
			);

			store.update((draft) => {
				draft.tickets.push(...(titles.length ? titles : ["First", "Second"]).map((title) => item(title)));
			});

			return store;
		};

		it("edits new items and replaced nested objects within one recipe", () => {
			const store = setupItems();

			store.update((draft) => {
				draft.tickets.push(item("Third"));
				draft.tickets[2].tags.push("two");
				draft.tickets[0].assignee = { name: "Bob", key: "new" };
				draft.tickets[0].assignee.name = "Cy";
			});
			expect(store.read().tickets[2]).toStrictEqual({ ...item("Third"), tags: ["one", "two"] });
			expect(store.read().tickets[0].assignee).toStrictEqual({ name: "Cy", key: "new" });
		});

		it("validates only the final result", () => {
			const store = setupItems();

			store.update((draft) => {
				Reflect.set(draft.tickets[0], "title", 42);
				Reflect.set(draft.tickets[0], "extra", true);
				draft.tickets[0].title = "Valid";
				Reflect.deleteProperty(draft.tickets[0], "extra");
				draft.tickets.reverse();
				draft.tickets.reverse();
			});
			expect(store.read().tickets[0].title).toBe("Valid");
		});

		it("keeps snapshots and notifications unchanged when edits cancel out", () => {
			const store = setupItems();
			const before = store.read();
			const listener = listen(store);

			store.update((draft) => {
				draft.tickets[0].title = "Temporary";
				draft.tickets[0].title = "First";
				draft.tickets[0].tags.push("temporary");
				draft.tickets[0].tags.pop();
			});
			expect(store.read()).toBe(before);
			expect(listener).not.toHaveBeenCalled();
		});

		it("detaches retained drafts and inserted caller-owned values", () => {
			const store = setupItems();
			const added = item("Third");

			let retained: string[] = [];

			store.update((draft) => {
				draft.tickets.push(added);
				retained = draft.tickets[0].tags;
				retained.push("two");
			});
			retained.push("late");
			added.tags.push("late");
			expect(store.read().tickets[0].tags).toStrictEqual(["one", "two"]);
			expect(store.read().tickets[2].tags).toStrictEqual(["one"]);
		});

		it("preserves surviving item entities while removing items", () => {
			const store = setupItems();
			const before = store.read();

			store.update((draft) => {
				draft.tickets[0].assignee.name = "Cy";
				const removed = draft.tickets.pop();

				if (removed) removed.title = "Detached";
			});
			expect(store.read().tickets).toHaveLength(1);
			expect(store.read().tickets[0].tags).toBe(before.tickets[0].tags);
			expect(store.read().tickets[0].assignee.name).toBe("Cy");
		});

		it("gives an equal-valued fresh replacement a new identity", () => {
			const store = setupItems("First");
			const before = store.read();
			const listener = listen(store);

			store.update((draft) => {
				draft.tickets[0] = item();
			});
			expect(store.read()).toStrictEqual(before);
			expect(listener).toHaveBeenCalledOnce();
		});

		it("reads a computed field once while preserving item identity", () => {
			const store = setupItems();
			const before = store.read();

			let reads = 0;

			store.update((draft) => {
				Object.defineProperty(draft.tickets[0], "title", {
					enumerable: true,
					get: () => (++reads === 1 ? "Computed" : 42),
				});
			});
			expect(store.read().tickets[0].title).toBe("Computed");
			expect(store.read().tickets[0].tags).toBe(before.tickets[0].tags);
			expect(reads).toBe(1);
		});
	});

	describe("lazy updates", () => {
		type Ticket = InferStateType<typeof assignedSchema>["tickets"][number];

		it("reads the collection once for a one-field item update", () => {
			const store = setup();
			const lists = vi.spyOn(RGA.prototype, "current", "get");

			store.update((draft) => {
				draft.tickets[1].title = "Changed";
			});

			expect(lists).toHaveBeenCalledOnce();
			expect(store.read().tickets[1].title).toBe("Changed");
		});

		it("fills no other item for a one-field item update", () => {
			const store = setup();
			const maps = vi.spyOn(LWWMap.prototype, "current", "get");

			store.update((draft) => {
				draft.tickets[1].assignee.name = "Cy";
			});

			expect(maps.mock.calls.length).toBeLessThanOrEqual(3);
			expect(store.read().tickets[1].assignee.name).toBe("Cy");
		});

		it("reads nothing for a recipe that changes nothing", () => {
			const store = setup();
			const lists = vi.spyOn(RGA.prototype, "current", "get");
			const maps = vi.spyOn(LWWMap.prototype, "current", "get");

			store.update(() => {});

			expect(lists).not.toHaveBeenCalled();
			expect(maps).not.toHaveBeenCalled();
		});

		it("writes back a draft item kept from an earlier update", () => {
			const store = setup();

			let kept: Ticket | undefined;

			store.update((draft) => {
				kept = draft.tickets[0];
				expect(kept.title).toBe("First");
			});
			store.update((draft) => {
				draft.tickets[0].title = "Changed";
			});
			store.update((draft) => {
				if (kept) draft.tickets = [kept];
			});

			expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First"]);
		});

		it("writes back an item kept from a recipe that throws", () => {
			const store = setup();

			let kept: Ticket | undefined;

			expect(() =>
				store.update((draft) => {
					kept = draft.tickets[0];
					expect(kept.title).toBe("First");
					throw new Error("stop");
				}),
			).toThrow("stop");
			store.update((draft) => {
				draft.tickets[0].title = "Changed";
			});
			store.update((draft) => {
				if (kept) draft.tickets = [kept];
			});

			expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First"]);
		});

		it("edits an item found by scanning the collection", () => {
			const store = setup();
			const before = store.read();

			store.update((draft) => {
				const found = draft.tickets.find((item) => item.title === "Second");

				if (found) found.title = "Found";
			});

			expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Found"]);
			expect(store.read().tickets[0]).toBe(before.tickets[0]);
		});

		it("reconciles only the edited item after scanning the collection", () => {
			const store = setup();
			const lookups = vi.spyOn(RGA.prototype, "find");

			store.update((draft) => {
				const found = draft.tickets.find((item) => item.title === "First");

				if (found) found.assignee.name = "Cy";
			});

			expect(lookups).not.toHaveBeenCalled();
			expect(store.read().tickets.map(({ assignee }) => assignee.name)).toStrictEqual(["Cy", "Bob"]);
		});

		it("pushes a spread draft item as a new item", () => {
			const store = setup();

			store.update((draft) => {
				draft.tickets.push({ ...draft.tickets[0], assignee: { ...draft.tickets[0].assignee } });
			});

			expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Second", "First"]);
		});
	});

	describe("nested collections", () => {
		const setupBoards = () => {
			const store = new Store(
				object({ boards: array(object({ comments: array(object({ key: string(), text: string() })) })) }),
			);

			store.update((draft) => {
				draft.boards.push({ comments: [{ key: "public", text: "Hello" }] }, { comments: [] });
			});

			return store;
		};

		it("edits scalar and object collections under an object entry", () => {
			const store = new Store(
				object({
					board: object({
						title: string(),
						tickets: array(
							object({ title: string(), tags: array(string()), comments: array(object({ text: string() })) }),
						),
					}),
				}),
			);

			store.update((draft) => {
				draft.board.tickets.push({ title: "First", tags: ["red"], comments: [{ text: "Hello" }] });
			});
			store.update((draft) => {
				draft.board.title = "Sprint";
				draft.board.tickets[0].tags.unshift("green");
				draft.board.tickets[0].comments[0].text = "Changed";
				draft.board.tickets[0].comments.push({ text: "Added" });
			});
			expect(store.read().board).toStrictEqual({
				title: "Sprint",
				tickets: [{ title: "First", tags: ["green", "red"], comments: [{ text: "Changed" }, { text: "Added" }] }],
			});
		});

		it("treats fields named key as ordinary fields", () => {
			const store = setupBoards();

			store.update((draft) => {
				draft.boards[0].comments[0].key = "edited";
			});
			expectTypeOf(store.read().boards[0].comments).toEqualTypeOf<
				ReadonlyArray<{ readonly key: string; readonly text: string }>
			>();
			expect(store.read().boards[0].comments[0]).toStrictEqual({ key: "edited", text: "Hello" });
		});

		it("moves an item between same-named collections", () => {
			const store = setupBoards();

			store.update((draft) => {
				const comment = draft.boards[0].comments.pop();

				if (comment) draft.boards[1].comments.push(comment);
			});
			expect(store.read().boards.map((board) => board.comments)).toStrictEqual([
				[],
				[{ key: "public", text: "Hello" }],
			]);
		});

		it("reads each collection once for a nested one-field update", () => {
			const store = setupBoards();
			const lists = vi.spyOn(RGA.prototype, "current", "get");

			store.update((draft) => {
				draft.boards[0].comments[0].text = "Changed";
			});

			expect(lists).toHaveBeenCalledTimes(2);
			expect(store.read().boards[0].comments[0].text).toBe("Changed");
		});
	});

	describe("moves within a recipe", () => {
		const item = object({ title: string() });
		const person = object({ name: string() });
		const titles = (items: ReadonlyArray<{ readonly title: string }>) => items.map(({ title }) => title);

		describe.each([
			{ order: "a before b", shape: object({ a: array(item), b: array(item) }) },
			{ order: "b before a", shape: object({ b: array(item), a: array(item) }) },
		])("with collections declared $order", ({ shape }) => {
			it("swaps two collections", () => {
				const store = new Store(shape);

				store.update((draft) => {
					draft.a.push({ title: "A" });
					draft.b.push({ title: "B" });
				});
				store.update((draft) => {
					const a = draft.a;

					draft.a = draft.b;
					draft.b = a;
				});

				expect(titles(store.read().a)).toStrictEqual(["B"]);
				expect(titles(store.read().b)).toStrictEqual(["A"]);
			});
		});

		describe.each([
			{ order: "x before y", shape: object({ x: person, y: person }) },
			{ order: "y before x", shape: object({ y: person, x: person }) },
		])("with objects declared $order", ({ shape }) => {
			it("swaps two objects", () => {
				const store = new Store(shape);

				store.update((draft) => {
					draft.x.name = "X";
					draft.y.name = "Y";
				});
				store.update((draft) => {
					const x = draft.x;

					draft.x = draft.y;
					draft.y = x;
				});

				expect(store.read()).toStrictEqual({ x: { name: "Y" }, y: { name: "X" } });
			});
		});

		describe.each([
			{ order: "tickets before archive", shape: object({ tickets: array(item), archive: array(item) }) },
			{ order: "archive before tickets", shape: object({ archive: array(item), tickets: array(item) }) },
		])("with collections declared $order", ({ shape }) => {
			it("keeps the items of a collection that is moved and then cleared", () => {
				const store = new Store(shape);

				store.update((draft) => {
					draft.tickets.push({ title: "A" }, { title: "B" });
				});
				store.update((draft) => {
					draft.archive = draft.tickets;
					draft.tickets = [];
				});

				expect(titles(store.read().archive)).toStrictEqual(["A", "B"]);
				expect(store.read().tickets).toStrictEqual([]);
			});
		});

		describe.each([
			{ order: "x before y", shape: object({ x: object({ child: person }), y: object({ child: person }) }) },
			{ order: "y before x", shape: object({ y: object({ child: person }), x: object({ child: person }) }) },
		])("with nested objects declared $order", ({ shape }) => {
			it("swaps two objects with unread nested objects", () => {
				const store = new Store(shape);

				store.update((draft) => {
					draft.x.child.name = "X";
					draft.y.child.name = "Y";
				});
				store.update((draft) => {
					const x = draft.x;

					draft.x = draft.y;
					draft.y = x;
				});

				expect(store.read()).toStrictEqual({ x: { child: { name: "Y" } }, y: { child: { name: "X" } } });
			});
		});

		describe.each([
			{ order: "x before y", shape: object({ x: object({ items: array(item) }), y: object({ items: array(item) }) }) },
			{ order: "y before x", shape: object({ y: object({ items: array(item) }), x: object({ items: array(item) }) }) },
		])("with objects holding collections declared $order", ({ shape }) => {
			it("swaps two objects with unread collections", () => {
				const store = new Store(shape);

				store.update((draft) => {
					draft.x.items.push({ title: "X1" }, { title: "X2" });
					draft.y.items.push({ title: "Y1" });
				});
				store.update((draft) => {
					const x = draft.x;

					draft.x = draft.y;
					draft.y = x;
				});

				expect(titles(store.read().x.items)).toStrictEqual(["Y1"]);
				expect(titles(store.read().y.items)).toStrictEqual(["X1", "X2"]);
			});
		});

		it("keeps an inner update's write that the outer recipe never read", () => {
			const store = setup();

			store.update((outer) => {
				store.update((inner) => {
					inner.language = "cs";
				});
				outer.tickets[0].title = "Outer";
			});

			expect(store.read().language).toBe("cs");
			expect(store.read().tickets[0].title).toBe("Outer");
		});

		it("keeps the outer copy of a map it read before an inner update", () => {
			const store = setup();

			store.update((outer) => {
				expect(outer.language).toBe("en");
				store.update((inner) => {
					inner.language = "cs";
				});
				outer.tickets[0].title = "Outer";
			});

			expect(store.read().language).toBe("en");
		});

		it("keeps the outer copy of an item an inner update removed after the outer recipe filled its collection", () => {
			const store = setup();

			store.update((outer) => {
				outer.tickets.push({ title: "Third", assignee: { name: "Cid" } });
				store.update((inner) => {
					inner.tickets.splice(0, 1);
				});
			});

			expect(store.read().tickets).toStrictEqual([
				{ title: "Second", assignee: { name: "Bob" } },
				{ title: "First", assignee: { name: "Ann" } },
				{ title: "Third", assignee: { name: "Cid" } },
			]);
		});
	});

	describe("notifications", () => {
		it("passes every changed field, encoded, in one call", () => {
			const store = new Store(ticketsSchema);
			const listener = listen(store);

			store.update((draft) => {
				draft.language = "cs";
				draft.tickets.push({ title: "A" });
			});

			expect(listener).toHaveBeenCalledExactlyOnceWith({
				language: store.encode().data.language,
				tickets: store.encode().data.tickets,
			});
		});

		it("doesn't encode changes until a listener reads them", () => {
			const store = new Store(ticketsSchema);
			const encode = vi.spyOn(Codec.prototype, "encode");
			const listener = listen(store);

			store.update((draft) => {
				draft.language = "cs";
			});

			const changes = listener.mock.calls[0][0];

			expect(Object.keys(changes)).toStrictEqual(["language"]);
			expect(encode).not.toHaveBeenCalled();
			expect(changes.language).toBe(changes.language);
			expect(encode).toHaveBeenCalledOnce();
		});

		it("publishes one final snapshot per update and ignores returned values", () => {
			const store = setup();
			const observed: unknown[] = [];
			const listener = vi.fn(() => {
				observed.push(store.read());
			});

			store.onChange(listener);
			store.update((draft) => {
				draft.language = "cs";
				draft.tickets[0].title = "Changed";

				return { language: "ignored", tickets: [] };
			});
			expect(listener).toHaveBeenCalledExactlyOnceWith({
				tickets: expect.objectContaining({ key: "tickets" }),
				language: expect.objectContaining({ key: "language" }),
			});
			expect(observed).toStrictEqual([store.read()]);
			expect(store.read().language).toBe("cs");
			expect(store.read().tickets[0].title).toBe("Changed");
		});

		it("delivers updates made by a listener as a separate notification", () => {
			const store = setup();
			const observed: string[][] = [];

			store.onChange((changes) => {
				const keys = Object.keys(changes);

				observed.push(keys);

				if (keys.includes("language")) {
					store.update((draft) => {
						draft.tickets.shift();
					});
				}
			});
			store.update((draft) => {
				draft.language = "cs";
			});
			expect(observed).toStrictEqual([["language"], ["tickets"]]);
		});

		it("stops notifying a listener that unsubscribes", () => {
			const store = new Store(ticketsSchema);
			const listener = vi.fn();
			const unsubscribe = store.onChange(listener);

			store.update((draft) => {
				draft.language = "cs";
			});
			unsubscribe();
			store.update((draft) => {
				draft.language = "de";
			});

			expect(listener).toHaveBeenCalledOnce();
		});

		it("calls every listener when one unsubscribes during notification", () => {
			const store = new Store(ticketsSchema);
			const unsubscribe = store.onChange(() => unsubscribe());
			const second = listen(store);

			store.update((draft) => {
				draft.language = "cs";
			});

			expect(second).toHaveBeenCalledOnce();
		});
	});

	describe("merges", () => {
		it("merges an encoded field from another store and notifies once", () => {
			const remote = new Store(ticketsSchema);
			const store = new Store(ticketsSchema);
			const listener = listen(store);

			remote.update((draft) => {
				draft.language = "cs";
			});
			store.merge("language", remote.encode().data.language);

			expect(store.read().language).toBe("cs");
			expect(listener).toHaveBeenCalledExactlyOnceWith({ language: expect.objectContaining({ key: "language" }) });
		});

		it("notifies once when a merge changes several fields of one entry", () => {
			const store = new Store(object({ profile: object({ name: string(), score: number() }) }));
			const listener = listen(store);

			store.merge(
				"profile",
				new LWWMap(
					{ name: new LWWRegister("Ann", "name", Time.now()), score: new LWWRegister(5, "score", Time.now()) },
					"profile",
				).encode(),
			);
			expect(store.read().profile).toStrictEqual({ name: "Ann", score: 5 });
			expect(listener).toHaveBeenCalledOnce();
		});

		it("throws when merging a value that can't be decoded", () => {
			expect(() => new Store(ticketsSchema).merge("language", { nope: true })).toThrow("Invalid encoded entity.");
		});

		it("ignores a merge into an unknown or inherited field or with another field's value", () => {
			const store = new Store(ticketsSchema);
			const before = store.read();
			const listener = listen(store);

			store.merge("missing", store.encode().data.language);
			store.merge("constructor", new LWWRegister("x", "constructor", Time.now()).encode());
			store.merge("language", store.encode().data.tickets);
			store.merge("language", new LWWRegister("cs", "other", Time.now()).encode());

			expect(listener).not.toHaveBeenCalled();
			expect(store.read()).toBe(before);
		});

		it("keeps newer local values", () => {
			const store = new Store(ticketsSchema);
			const older = Time.now();

			store.update((draft) => {
				draft.language = "cs";
			});
			const listener = listen(store);

			store.merge("language", new LWWRegister("de", "language", older).encode());
			expect(store.read().language).toBe("cs");
			expect(listener).not.toHaveBeenCalled();
		});

		it("completes a merged item without minting timestamps", () => {
			const store = new Store(assignedSchema);
			const remote = new RGA([new LWWMap({}, "item")], "tickets");
			const now = vi.spyOn(Time, "now");

			store.merge("tickets", remote.encode());

			expect(store.read().tickets).toStrictEqual([{ title: "", assignee: { name: "" } }]);
			expect(now).not.toHaveBeenCalled();
		});

		it("keeps a removed item removed when a stale copy merges", () => {
			const store = setup();
			const stale = store.encode().data.tickets;

			store.update((draft) => {
				draft.tickets = draft.tickets.filter((item) => item.title !== "First");
			});
			store.merge("tickets", stale);

			expect(store.read().tickets.map((item) => item.title)).toStrictEqual(["Second"]);
		});

		it("removes an item that a remote replica removed", () => {
			const remote = setup();
			const store = new Store(assignedSchema);

			store.merge("tickets", remote.encode().data.tickets);
			remote.update((draft) => {
				draft.tickets = draft.tickets.filter((item) => item.title !== "First");
			});
			store.merge("tickets", remote.encode().data.tickets);

			expect(store.read().tickets.map((item) => item.title)).toStrictEqual(["Second"]);
		});

		describe("merging data saved by another schema", () => {
			const comment = object({ body: string(), author: string() });
			const current = object({ tickets: array(object({ title: string(), comments: array(comment) })) });

			it("fills a field added after the item was saved", () => {
				const older = new Store(object({ tickets: array(object({ title: string() })) }));
				const store = new Store(current);

				older.update((draft) => {
					draft.tickets.push({ title: "Old" });
				});
				store.merge("tickets", older.encode().data.tickets);

				expect(store.read().tickets).toStrictEqual([{ title: "Old", comments: [] }]);
			});

			it("fills a field missing from a nested item", () => {
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

			it("keeps fields the schema does not declare on a new item", () => {
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

			it("keeps every item when a nested field changed kind", () => {
				const older = new Store(object({ tickets: array(object({ title: string(), comments: string() })) }));
				const store = new Store(current);

				older.update((draft) => {
					draft.tickets.push({ title: "First", comments: "none" }, { title: "Second", comments: "none" });
				});
				store.merge("tickets", older.encode().data.tickets);

				expect(store.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Second"]);
			});

			it("keeps local values when an older copy of the same item arrives", () => {
				const store = new Store(current);
				const older = Time.now();
				const item = createReconciliationStrategy(current.properties.tickets.items).create(
					{ title: "New", comments: [{ body: "Hi", author: "Ann" }] },
					"t1",
				);
				const stale = new LWWMap({ title: new LWWRegister("Stale", "title", older) }, "t1");

				store.merge("tickets", new RGA([item], "tickets").encode());
				store.merge("tickets", new RGA([stale], "tickets").encode());

				expect(store.read().tickets).toStrictEqual([{ title: "New", comments: [{ body: "Hi", author: "Ann" }] }]);
			});
		});
	});

	describe("encoding", () => {
		it("encodes every top-level field", () => {
			const store = new Store(assignedSchema);

			store.update((draft) => {
				draft.language = "cs";
			});

			const { key, data } = store.encode();

			expect(key).toBe("state");
			expect(Object.keys(data)).toStrictEqual(["tickets", "language"]);
			expect(data.language).toMatchObject({ key: "language", data: "cs", metadata: { kind: "LWWRegister" } });
		});

		it("encodes a collection as items of field entities with their timestamps", () => {
			const items = new RGA([createReconciliationStrategy(ticket).create({ title: "A" }, "item-1")], "tickets");

			expect(items.encode()).toMatchObject({
				metadata: { kind: "RGA" },
				data: [
					{
						key: "item-1",
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
				[createReconciliationStrategy(ticket).create({ title: "A" }, "item-1")],
				"tickets",
			).encode();
			const now = vi.spyOn(Time, "now");
			const restored = new RGA<Entity>([], "tickets");
			const decoded = new Codec().decode(saved);

			RGA.assert(decoded);

			restored.merge(decoded);

			expect(now).not.toHaveBeenCalled();
			expect(restored.encode()).toStrictEqual(saved);
		});
	});
});
