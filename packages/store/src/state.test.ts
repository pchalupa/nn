import { Codec } from "@nn/entities/codec";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { array, boolean, type InferStateType, number, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { State, type StateDelegate } from "./state";

const ticket = object({ title: string(), assignee: object({ name: string() }) });
const schema = object({ tickets: array(ticket), language: string() });

const setup = () => {
	const state = new State(schema);

	state.update((draft) => {
		draft.tickets.push({ title: "First", assignee: { name: "Ann" } }, { title: "Second", assignee: { name: "Bob" } });
		draft.language = "en";
	});

	return state;
};

const listen = (state: { delegate?: StateDelegate }) => {
	const listener = vi.fn<StateDelegate["stateDidChange"]>();

	state.delegate = { stateDidChange: listener };

	return listener;
};

describe("State reads", () => {
	afterEach(() => vi.restoreAllMocks());

	it("reads the state as schema-shaped data", () => {
		expect(setup().read()).toStrictEqual({
			language: "en",
			tickets: [
				{ title: "First", assignee: { name: "Ann" } },
				{ title: "Second", assignee: { name: "Bob" } },
			],
		});
	});

	it("protects cached snapshots passed to a mutable consumer", () => {
		const state = setup();
		const before = state.read();
		const listener = listen(state);
		const rename = (assignee: { name: string }) => {
			assignee.name = "Changed";
		};

		expect(() => rename(before.tickets[0].assignee)).toThrow(TypeError);
		expect(state.read()).toBe(before);
		expect(state.read().tickets[0].assignee.name).toBe("Ann");
		expect(listener).not.toHaveBeenCalled();
		state.update((draft) => {
			draft.language = "cs";
		});
		expect(state.read().tickets).toBe(before.tickets);
		expect(state.read().tickets[0].assignee.name).toBe("Ann");
		expect(listener).toHaveBeenCalledOnce();
	});

	it("reuses unchanged projections without reading their entities again", () => {
		const state = setup();
		const reads = vi.spyOn(RGA.prototype, "current", "get");
		const before = state.read();

		expect(state.read()).toBe(before);
		expect(reads).toHaveBeenCalledOnce();
		state.update((draft) => {
			draft.language = "cs";
		});
		state.update(() => {});
		reads.mockClear();
		expect(state.read()).not.toBe(before);
		expect(state.read().tickets).toBe(before.tickets);
		expect(reads).not.toHaveBeenCalled();
	});

	it("rebuilds only the rows and fields that changed", () => {
		const state = setup();
		const before = state.read();

		state.update((draft) => {
			draft.tickets[0].title = "Changed";
		});
		const after = state.read();

		expect(after.tickets).not.toBe(before.tickets);
		expect(after.tickets[1]).toBe(before.tickets[1]);
		expect(after.tickets[0].assignee).toBe(before.tickets[0].assignee);
		expect(before.tickets[0].title).toBe("First");
	});

	it("preserves an object entry's snapshot when another entry changes", () => {
		const state = new State(object({ settings: object({ theme: string() }), tickets: array(ticket) }));
		const before = state.read().settings;

		state.update((draft) => {
			draft.tickets.push({ title: "First", assignee: { name: "Ann" } });
		});
		expect(state.read().settings).toBe(before);
	});
});

describe("State updates", () => {
	afterEach(() => vi.restoreAllMocks());

	it("hands the recipe an independent copy of the current snapshot", () => {
		const state = setup();
		const before = state.read();

		let retained: unknown[] = [];

		state.update((draft) => {
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
		expect(state.read().tickets).toHaveLength(2);
		expect(state.read().tickets[0].assignee.name).toBe("Edited");
	});

	it("updates primitive fields without structured cloning", () => {
		const state = setup();
		const cloned = vi.spyOn(globalThis, "structuredClone");

		state.update((draft) => {
			draft.tickets[0].title = "Changed";
			draft.language = "cs";
		});
		expect(cloned).not.toHaveBeenCalled();
		expect(state.read().tickets[0].title).toBe("Changed");
	});

	it("removes and appends rows while retaining surviving entities", () => {
		const state = setup();
		const before = state.read();

		state.update((draft) => {
			draft.tickets.shift();
			draft.tickets.push({ title: "Third", assignee: { name: "Cy" } });
		});
		expect(state.read().tickets[0]).toBe(before.tickets[1]);
		expect(state.read().tickets.map((row) => row.title)).toStrictEqual(["Second", "Third"]);
		state.update((draft) => {
			draft.tickets.length = 0;
		});
		expect(state.read().tickets).toStrictEqual([]);
	});

	it("tells rows apart by identity rather than by value", () => {
		const state = setup();
		const third = () => ({ title: "Third", assignee: { name: "Cy" } });

		state.update((draft) => {
			draft.tickets.push(draft.tickets[0], third(), third());
		});
		expect(state.read().tickets).toHaveLength(4);
	});

	it("recognizes a surviving row from an older snapshot after its projection is rebuilt", () => {
		const state = setup();
		const saved = state.read().tickets[1];

		state.update((draft) => {
			draft.tickets[1].title = "Changed";
		});
		expect(state.read().tickets[1]).not.toBe(saved);
		const assignee = state.read().tickets[1].assignee;

		state.update((draft) => {
			draft.tickets = [saved];
		});
		expect(state.read().tickets[0].assignee).toBe(assignee);
		expect(state.read().tickets).toStrictEqual([saved]);
	});

	it("gives a spread snapshot row a new identity", () => {
		const state = setup();
		const saved = state.read().tickets[0];
		const assignee = saved.assignee;

		state.update((draft) => {
			draft.tickets = [{ ...saved, title: "Changed" }];
		});

		expect(state.read().tickets[0].title).toBe("Changed");
		expect(state.read().tickets[0].assignee).not.toBe(assignee);
	});

	it("gives a snapshot row from another store a new identity", () => {
		const state = setup();
		const foreign = setup().read().tickets[0];
		const assignee = state.read().tickets[0].assignee;

		state.update((draft) => {
			draft.tickets = [foreign];
		});

		expect(state.read().tickets).toStrictEqual([foreign]);
		expect(state.read().tickets[0].assignee).not.toBe(assignee);
	});

	it("treats a reinserted removed snapshot row as a new row", () => {
		const state = setup();
		const saved = state.read().tickets[0];

		state.update((draft) => {
			draft.tickets.length = 0;
		});
		state.update((draft) => {
			draft.tickets.push(saved);
		});
		expect(state.read().tickets).toStrictEqual([saved]);
	});

	it("applies nothing when the recipe throws after editing", () => {
		const state = setup();
		const before = state.read();

		expect(() =>
			state.update((draft) => {
				draft.language = "cs";
				throw new Error("stop");
			}),
		).toThrow("stop");
		expect(state.read()).toBe(before);
	});

	it.each<{ name: string; recipe: (draft: InferStateType<typeof schema>) => void }>([
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
				draft.tickets = draft.tickets.filter((row) => row.title !== "Missing");
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
		const state = setup();
		const before = state.read();
		const listener = listen(state);

		state.update(recipe);
		expect(state.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
	});
});

describe("State draft edits", () => {
	const row = (title = "First") => ({ title, assignee: { name: "Ann", key: "data" }, tags: ["one"] });

	const setupRows = (...titles: string[]) => {
		const state = new State(
			object({
				language: string(),
				tickets: array(
					object({ title: string(), assignee: object({ name: string(), key: string() }), tags: array(string()) }),
				),
			}),
		);

		state.update((draft) => {
			draft.tickets.push(...(titles.length ? titles : ["First", "Second"]).map((title) => row(title)));
		});

		return state;
	};

	it("edits new rows and replaced nested objects within one recipe", () => {
		const state = setupRows();

		state.update((draft) => {
			draft.tickets.push(row("Third"));
			draft.tickets[2].tags.push("two");
			draft.tickets[0].assignee = { name: "Bob", key: "new" };
			draft.tickets[0].assignee.name = "Cy";
		});
		expect(state.read().tickets[2]).toStrictEqual({ ...row("Third"), tags: ["one", "two"] });
		expect(state.read().tickets[0].assignee).toStrictEqual({ name: "Cy", key: "new" });
	});

	it("validates only the final result", () => {
		const state = setupRows();

		state.update((draft) => {
			Reflect.set(draft.tickets[0], "title", 42);
			Reflect.set(draft.tickets[0], "extra", true);
			draft.tickets[0].title = "Valid";
			Reflect.deleteProperty(draft.tickets[0], "extra");
			draft.tickets.reverse();
			draft.tickets.reverse();
		});
		expect(state.read().tickets[0].title).toBe("Valid");
	});

	it("keeps snapshots and notifications unchanged when edits cancel out", () => {
		const state = setupRows();
		const before = state.read();
		const listener = listen(state);

		state.update((draft) => {
			draft.tickets[0].title = "Temporary";
			draft.tickets[0].title = "First";
			draft.tickets[0].tags.push("temporary");
			draft.tickets[0].tags.pop();
		});
		expect(state.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
	});

	it("detaches retained drafts and inserted caller-owned values", () => {
		const state = setupRows();
		const added = row("Third");

		let retained: string[] = [];

		state.update((draft) => {
			draft.tickets.push(added);
			retained = draft.tickets[0].tags;
			retained.push("two");
		});
		retained.push("late");
		added.tags.push("late");
		expect(state.read().tickets[0].tags).toStrictEqual(["one", "two"]);
		expect(state.read().tickets[2].tags).toStrictEqual(["one"]);
	});

	it("preserves surviving row entities while removing rows", () => {
		const state = setupRows();
		const before = state.read();

		state.update((draft) => {
			draft.tickets[0].assignee.name = "Cy";
			const removed = draft.tickets.pop();

			if (removed) removed.title = "Detached";
		});
		expect(state.read().tickets).toHaveLength(1);
		expect(state.read().tickets[0].tags).toBe(before.tickets[0].tags);
		expect(state.read().tickets[0].assignee.name).toBe("Cy");
	});

	it("gives an equal-valued fresh replacement a new identity", () => {
		const state = setupRows("First");
		const before = state.read();
		const listener = listen(state);

		state.update((draft) => {
			draft.tickets[0] = row();
		});
		expect(state.read()).toStrictEqual(before);
		expect(listener).toHaveBeenCalledOnce();
	});

	it("reads a computed field once while preserving row identity", () => {
		const state = setupRows();
		const before = state.read();

		let reads = 0;

		state.update((draft) => {
			Object.defineProperty(draft.tickets[0], "title", {
				enumerable: true,
				get: () => (++reads === 1 ? "Computed" : 42),
			});
		});
		expect(state.read().tickets[0].title).toBe("Computed");
		expect(state.read().tickets[0].tags).toBe(before.tickets[0].tags);
		expect(reads).toBe(1);
	});
});

describe("State lazy updates", () => {
	afterEach(() => vi.restoreAllMocks());

	type Ticket = InferStateType<typeof schema>["tickets"][number];

	it("reads the collection once for a one-field row update", () => {
		const state = setup();
		const lists = vi.spyOn(RGA.prototype, "current", "get");

		state.update((draft) => {
			draft.tickets[1].title = "Changed";
		});

		expect(lists).toHaveBeenCalledOnce();
		expect(state.read().tickets[1].title).toBe("Changed");
	});

	it("fills no other row for a one-field row update", () => {
		const state = setup();
		const maps = vi.spyOn(LWWMap.prototype, "current", "get");

		state.update((draft) => {
			draft.tickets[1].assignee.name = "Cy";
		});

		expect(maps.mock.calls.length).toBeLessThanOrEqual(3);
		expect(state.read().tickets[1].assignee.name).toBe("Cy");
	});

	it("reads nothing for a recipe that changes nothing", () => {
		const state = setup();
		const lists = vi.spyOn(RGA.prototype, "current", "get");
		const maps = vi.spyOn(LWWMap.prototype, "current", "get");

		state.update(() => {});

		expect(lists).not.toHaveBeenCalled();
		expect(maps).not.toHaveBeenCalled();
	});

	it("writes back a draft row kept from an earlier update", () => {
		const state = setup();

		let kept: Ticket | undefined;

		state.update((draft) => {
			kept = draft.tickets[0];
			expect(kept.title).toBe("First");
		});
		state.update((draft) => {
			draft.tickets[0].title = "Changed";
		});
		state.update((draft) => {
			if (kept) draft.tickets = [kept];
		});

		expect(state.read().tickets.map(({ title }) => title)).toStrictEqual(["First"]);
	});

	it("writes back a row kept from a recipe that throws", () => {
		const state = setup();

		let kept: Ticket | undefined;

		expect(() =>
			state.update((draft) => {
				kept = draft.tickets[0];
				expect(kept.title).toBe("First");
				throw new Error("stop");
			}),
		).toThrow("stop");
		state.update((draft) => {
			draft.tickets[0].title = "Changed";
		});
		state.update((draft) => {
			if (kept) draft.tickets = [kept];
		});

		expect(state.read().tickets.map(({ title }) => title)).toStrictEqual(["First"]);
	});

	it("edits a row found by scanning the collection", () => {
		const state = setup();
		const before = state.read();

		state.update((draft) => {
			const found = draft.tickets.find((row) => row.title === "Second");

			if (found) found.title = "Found";
		});

		expect(state.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Found"]);
		expect(state.read().tickets[0]).toBe(before.tickets[0]);
	});

	it("reconciles only the edited row after scanning the collection", () => {
		const state = setup();
		const lookups = vi.spyOn(RGA.prototype, "find");

		state.update((draft) => {
			const found = draft.tickets.find((row) => row.title === "First");

			if (found) found.assignee.name = "Cy";
		});

		expect(lookups).not.toHaveBeenCalled();
		expect(state.read().tickets.map(({ assignee }) => assignee.name)).toStrictEqual(["Cy", "Bob"]);
	});

	it("pushes a spread draft row as a new row", () => {
		const state = setup();

		state.update((draft) => {
			draft.tickets.push({ ...draft.tickets[0], assignee: { ...draft.tickets[0].assignee } });
		});

		expect(state.read().tickets.map(({ title }) => title)).toStrictEqual(["First", "Second", "First"]);
	});
});

describe("State nested collections", () => {
	const setupBoards = () => {
		const state = new State(
			object({ boards: array(object({ comments: array(object({ key: string(), text: string() })) })) }),
		);

		state.update((draft) => {
			draft.boards.push({ comments: [{ key: "public", text: "Hello" }] }, { comments: [] });
		});

		return state;
	};

	it("edits scalar and object collections under an object entry", () => {
		const state = new State(
			object({
				board: object({
					title: string(),
					tickets: array(
						object({ title: string(), tags: array(string()), comments: array(object({ text: string() })) }),
					),
				}),
			}),
		);

		state.update((draft) => {
			draft.board.tickets.push({ title: "First", tags: ["red"], comments: [{ text: "Hello" }] });
		});
		state.update((draft) => {
			draft.board.title = "Sprint";
			draft.board.tickets[0].tags.unshift("green");
			draft.board.tickets[0].comments[0].text = "Changed";
			draft.board.tickets[0].comments.push({ text: "Added" });
		});
		expect(state.read().board).toStrictEqual({
			title: "Sprint",
			tickets: [{ title: "First", tags: ["green", "red"], comments: [{ text: "Changed" }, { text: "Added" }] }],
		});
	});

	it("treats fields named key as ordinary fields", () => {
		const state = setupBoards();

		state.update((draft) => {
			draft.boards[0].comments[0].key = "edited";
		});
		expectTypeOf(state.read().boards[0].comments).toEqualTypeOf<
			ReadonlyArray<{ readonly key: string; readonly text: string }>
		>();
		expect(state.read().boards[0].comments[0]).toStrictEqual({ key: "edited", text: "Hello" });
	});

	it("moves a row between same-named collections", () => {
		const state = setupBoards();

		state.update((draft) => {
			const comment = draft.boards[0].comments.pop();

			if (comment) draft.boards[1].comments.push(comment);
		});
		expect(state.read().boards.map((board) => board.comments)).toStrictEqual([[], [{ key: "public", text: "Hello" }]]);
	});

	it("reads each collection once for a nested one-field update", () => {
		const state = setupBoards();
		const lists = vi.spyOn(RGA.prototype, "current", "get");

		state.update((draft) => {
			draft.boards[0].comments[0].text = "Changed";
		});

		expect(lists).toHaveBeenCalledTimes(2);
		expect(state.read().boards[0].comments[0].text).toBe("Changed");
		vi.restoreAllMocks();
	});
});

describe("State moves within a recipe", () => {
	const item = object({ title: string() });
	const person = object({ name: string() });
	const titles = (items: ReadonlyArray<{ readonly title: string }>) => items.map(({ title }) => title);

	describe.each([
		{ order: "a before b", shape: object({ a: array(item), b: array(item) }) },
		{ order: "b before a", shape: object({ b: array(item), a: array(item) }) },
	])("with collections declared $order", ({ shape }) => {
		it("swaps two collections", () => {
			const state = new State(shape);

			state.update((draft) => {
				draft.a.push({ title: "A" });
				draft.b.push({ title: "B" });
			});
			state.update((draft) => {
				const a = draft.a;

				draft.a = draft.b;
				draft.b = a;
			});

			expect(titles(state.read().a)).toStrictEqual(["B"]);
			expect(titles(state.read().b)).toStrictEqual(["A"]);
		});
	});

	describe.each([
		{ order: "x before y", shape: object({ x: person, y: person }) },
		{ order: "y before x", shape: object({ y: person, x: person }) },
	])("with objects declared $order", ({ shape }) => {
		it("swaps two objects", () => {
			const state = new State(shape);

			state.update((draft) => {
				draft.x.name = "X";
				draft.y.name = "Y";
			});
			state.update((draft) => {
				const x = draft.x;

				draft.x = draft.y;
				draft.y = x;
			});

			expect(state.read()).toStrictEqual({ x: { name: "Y" }, y: { name: "X" } });
		});
	});

	describe.each([
		{ order: "tickets before archive", shape: object({ tickets: array(item), archive: array(item) }) },
		{ order: "archive before tickets", shape: object({ archive: array(item), tickets: array(item) }) },
	])("with collections declared $order", ({ shape }) => {
		it("keeps the rows of a collection that is moved and then cleared", () => {
			const state = new State(shape);

			state.update((draft) => {
				draft.tickets.push({ title: "A" }, { title: "B" });
			});
			state.update((draft) => {
				draft.archive = draft.tickets;
				draft.tickets = [];
			});

			expect(titles(state.read().archive)).toStrictEqual(["A", "B"]);
			expect(state.read().tickets).toStrictEqual([]);
		});
	});

	describe.each([
		{ order: "x before y", shape: object({ x: object({ child: person }), y: object({ child: person }) }) },
		{ order: "y before x", shape: object({ y: object({ child: person }), x: object({ child: person }) }) },
	])("with nested objects declared $order", ({ shape }) => {
		it("swaps two objects with unread nested objects", () => {
			const state = new State(shape);

			state.update((draft) => {
				draft.x.child.name = "X";
				draft.y.child.name = "Y";
			});
			state.update((draft) => {
				const x = draft.x;

				draft.x = draft.y;
				draft.y = x;
			});

			expect(state.read()).toStrictEqual({ x: { child: { name: "Y" } }, y: { child: { name: "X" } } });
		});
	});

	describe.each([
		{ order: "x before y", shape: object({ x: object({ items: array(item) }), y: object({ items: array(item) }) }) },
		{ order: "y before x", shape: object({ y: object({ items: array(item) }), x: object({ items: array(item) }) }) },
	])("with objects holding collections declared $order", ({ shape }) => {
		it("swaps two objects with unread collections", () => {
			const state = new State(shape);

			state.update((draft) => {
				draft.x.items.push({ title: "X1" }, { title: "X2" });
				draft.y.items.push({ title: "Y1" });
			});
			state.update((draft) => {
				const x = draft.x;

				draft.x = draft.y;
				draft.y = x;
			});

			expect(titles(state.read().x.items)).toStrictEqual(["Y1"]);
			expect(titles(state.read().y.items)).toStrictEqual(["X1", "X2"]);
		});
	});

	it("keeps an inner update's write that the outer recipe never read", () => {
		const state = setup();

		state.update((outer) => {
			state.update((inner) => {
				inner.language = "cs";
			});
			outer.tickets[0].title = "Outer";
		});

		expect(state.read().language).toBe("cs");
		expect(state.read().tickets[0].title).toBe("Outer");
	});

	it("keeps the outer copy of a map it read before an inner update", () => {
		const state = setup();

		state.update((outer) => {
			expect(outer.language).toBe("en");
			state.update((inner) => {
				inner.language = "cs";
			});
			outer.tickets[0].title = "Outer";
		});

		expect(state.read().language).toBe("en");
	});
});

describe("State notifications", () => {
	it("publishes one final snapshot per update and ignores returned values", () => {
		const state = setup();
		const observed: unknown[] = [];
		const listener = vi.fn(() => {
			observed.push(state.read());
		});

		state.delegate = { stateDidChange: listener };
		state.update((draft) => {
			draft.language = "cs";
			draft.tickets[0].title = "Changed";

			return { language: "ignored", tickets: [] };
		});
		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set([expect.any(RGA), expect.any(LWWRegister)]));
		expect(observed).toStrictEqual([state.read()]);
		expect(state.read().language).toBe("cs");
		expect(state.read().tickets[0].title).toBe("Changed");
	});

	it("stops notifying after unsubscribing", () => {
		const state = setup();
		const listener = listen(state);

		state.update((draft) => {
			draft.language = "cs";
		});
		state.delegate = undefined;
		state.update((draft) => {
			draft.language = "de";
		});
		expect(listener).toHaveBeenCalledOnce();
	});

	it("delivers updates made by a listener as a separate notification", () => {
		const state = setup();
		const observed: string[][] = [];

		state.delegate = {
			stateDidChange: (changed) => {
				const keys = [...changed].map((entity) => entity.key);

				observed.push(keys);

				if (keys.includes("language")) {
					state.update((draft) => {
						draft.tickets.shift();
					});
				}
			},
		};
		state.update((draft) => {
			draft.language = "cs";
		});
		expect(observed).toStrictEqual([["language"], ["tickets"]]);
	});
});

describe("State merges", () => {
	const languageSchema = object({ language: string() });

	afterEach(() => vi.restoreAllMocks());

	it("completes a merged row without minting timestamps", () => {
		const state = new State(schema);
		const remote = new RGA([new LWWMap({}, "row")], "tickets");
		const now = vi.spyOn(Time, "now");

		state.merge("tickets", remote);

		expect(state.read().tickets).toStrictEqual([{ title: "", assignee: { name: "" } }]);
		expect(now).not.toHaveBeenCalled();
	});

	it("merges a decoded entity into a field and notifies once", () => {
		const state = new State(languageSchema);
		const listener = listen(state);

		state.merge("language", new LWWRegister("cs", "language", Time.now()));
		expect(state.read().language).toBe("cs");
		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set([expect.any(LWWRegister)]));
	});

	it("notifies once when a merge changes several fields of one entry", () => {
		const state = new State(object({ profile: object({ name: string(), score: number() }) }));
		const listener = listen(state);

		state.merge(
			"profile",
			new LWWMap(
				{ name: new LWWRegister("Ann", "name", Time.now()), score: new LWWRegister(5, "score", Time.now()) },
				"profile",
			),
		);
		expect(state.read().profile).toStrictEqual({ name: "Ann", score: 5 });
		expect(listener).toHaveBeenCalledOnce();
	});

	it("keeps newer local values", () => {
		const state = new State(languageSchema);
		const older = Time.now();

		state.update((draft) => {
			draft.language = "cs";
		});
		const listener = listen(state);

		state.merge("language", new LWWRegister("de", "language", older));
		expect(state.read().language).toBe("cs");
		expect(listener).not.toHaveBeenCalled();
	});

	it("keeps a removed row removed when a stale copy merges", () => {
		const state = setup();
		const stale = new Codec().decode(state.encode().data.tickets);

		state.update((draft) => {
			draft.tickets = draft.tickets.filter((row) => row.title !== "First");
		});
		state.merge("tickets", stale);

		expect(state.read().tickets.map((row) => row.title)).toStrictEqual(["Second"]);
	});

	it("removes a row that a remote replica removed", () => {
		const remote = setup();
		const state = new State(schema);
		const codec = new Codec();

		state.merge("tickets", codec.decode(remote.encode().data.tickets));
		remote.update((draft) => {
			draft.tickets = draft.tickets.filter((row) => row.title !== "First");
		});
		state.merge("tickets", codec.decode(remote.encode().data.tickets));

		expect(state.read().tickets.map((row) => row.title)).toStrictEqual(["Second"]);
	});

	it("ignores merges into unknown or inherited names and entities stored under another key", () => {
		const state = new State(languageSchema);
		const before = state.read();
		const listener = listen(state);

		state.merge("language", new LWWRegister("cs", "other", Time.now()));
		state.merge("missing", new LWWRegister("x", "missing", Time.now()));
		state.merge("constructor", new LWWRegister("x", "constructor", Time.now()));
		expect(state.read()).toBe(before);
		expect(listener).not.toHaveBeenCalled();
	});
});

describe("State schema", () => {
	afterEach(() => vi.restoreAllMocks());

	it("initializes every declared shape without minting timestamps", () => {
		const now = vi.spyOn(Time, "now");
		const state = new State(
			object({ count: number(), enabled: boolean(), settings: object({ theme: string() }), tags: array(string()) }),
		);

		expect(state.read()).toStrictEqual({ count: 0, enabled: false, settings: { theme: "" }, tags: [] });
		expect(now).not.toHaveBeenCalled();
	});

	it("supports an empty schema", () => {
		const state = new State(object({}));
		const before = state.read();

		state.update(() => {});
		expect(before).toStrictEqual({});
		expect(state.read()).toBe(before);
	});

	it("infers the readonly snapshot and mutable draft from the schema", () => {
		const shape = object({
			language: string(),
			count: number(),
			enabled: boolean(),
			board: object({ tickets: array(object({ title: string(), tags: array(string()) })) }),
		});
		const state = new State(shape);

		expectTypeOf(state.read()).toEqualTypeOf<{
			readonly language: string;
			readonly count: number;
			readonly enabled: boolean;
			readonly board: {
				readonly tickets: ReadonlyArray<{ readonly title: string; readonly tags: readonly string[] }>;
			};
		}>();
		state.update((draft) => {
			expectTypeOf(draft).toEqualTypeOf<InferStateType<typeof shape>>();
			expectTypeOf<{ title: string }>().not.toExtend<Parameters<typeof draft.board.tickets.push>[0]>();
		});
	});
});

describe("State encoding", () => {
	it("encodes every top-level field", () => {
		const state = new State(schema);

		state.update((draft) => {
			draft.language = "cs";
		});

		const { key, data } = state.encode();

		expect(key).toBe("state");
		expect(Object.keys(data)).toStrictEqual(["tickets", "language"]);
		expect(data.language).toMatchObject({ key: "language", data: "cs", metadata: { kind: "LWWRegister" } });
	});
});
