import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import { array, number, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { PathError } from "./errors/PathError";
import { StoreError } from "./errors/StoreError";
import { type DataFromSchema, State } from "./State";

const schema = object({
	tickets: array(object({ title: string(), assignee: object({ name: string() }) })),
	language: string(),
});

const setup = () => {
	const state = State.fromSchema(schema);
	state.write(["tickets"], () => [
		{ key: "1", title: "First", assignee: { name: "Ann" } },
		{ key: "2", title: "Second", assignee: { name: "Bob" } },
	]);
	state.write(["language"], () => "en");
	return state;
};

const unchecked = (state: object) => {
	const method = (name: string) => {
		const fn: unknown = Reflect.get(state, name);
		if (typeof fn !== "function") throw new TypeError(`State has no "${name}" method.`);
		return (...args: unknown[]): unknown => fn.call(state, ...args);
	};
	return { read: method("read"), write: method("write") };
};

describe("State reads", () => {
	it("reads roots, rows and nested fields as frozen plain data", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);

		expect(tickets).toStrictEqual([
			{ key: "1", title: "First", assignee: { name: "Ann" } },
			{ key: "2", title: "Second", assignee: { name: "Bob" } },
		]);
		expect(Object.isFrozen(tickets)).toBe(true);
		expect(Object.isFrozen(tickets[0]?.assignee)).toBe(true);
		expect(state.read(["tickets", "1"])).toBe(tickets[0]);
		expect(state.read(["tickets", "1", "assignee"])).toBe(tickets[0]?.assignee);
		expect(state.read(["tickets", "1", "assignee", "name"])).toBe("Ann");
		expect(state.read(["language"])).toBe("en");
	});

	it("returns undefined for a missing row", () => {
		expect(setup().read(["tickets", "missing"])).toBeUndefined();
		expect(setup().read(["tickets", "missing", "title"])).toBeUndefined();
	});

	it("rejects unknown roots, rows on registers and missing fields", () => {
		const state = unchecked(setup());

		expect(() => state.read(["unknown"])).toThrow(PathError);
		expect(() => state.read(["language", "1"])).toThrow(PathError);
		expect(() => state.read(["tickets", "1", "missing"])).toThrow(PathError);
		expect(() => state.read(["tickets", "1", "title", "length"])).toThrow(PathError);
	});

	it("keeps references stable until the root changes", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);
		const language = state.read(["language"]);

		state.write(["language"], () => "cs");

		expect(state.read(["tickets"])).toBe(tickets);
		expect(state.read(["language"])).not.toBe(language);

		state.write(["tickets", "1", "title"], () => "Changed");

		const changed = state.read(["tickets"]);
		expect(changed).not.toBe(tickets);
		expect(changed[0]?.title).toBe("Changed");
		expect(tickets[0]?.title).toBe("First");
	});

	it("refreshes views after external entity changes", () => {
		const tickets = new RGA<LWWRegister<{ key: string; title: string }>>();
		const language = new LWWRegister("en");
		const state = State.fromEntries({ tickets, language });
		const before = state.read(["tickets"]);

		tickets.merge(new RGA([new LWWRegister({ key: "1", title: "Merged" }, "1")]));
		language.current = "cs";

		expect(state.read(["tickets"])).toStrictEqual([{ key: "1", title: "Merged" }]);
		expect(state.read(["tickets"])).not.toBe(before);
		expect(state.read(["language"])).toBe("cs");
	});
});

describe("State register writes", () => {
	it("replaces the value and skips equal results", () => {
		const language = new LWWRegister<unknown>({ code: "en" });
		const state = State.fromEntries({ language });
		const timestamp = language.timestamp;

		state.write(["language"], () => ({ code: "en" }));
		expect(language.timestamp).toBe(timestamp);

		state.write(["language"], () => ({ code: "cs" }));
		expect(language.current).toStrictEqual({ code: "cs" });
		expect(language.timestamp).not.toBe(timestamp);
	});

	it("passes a writable draft and detaches the stored value from it", () => {
		const state = State.fromEntries({ settings: new LWWRegister({ theme: "light" }) });
		let draft: { theme: string } | undefined;

		state.write(["settings"], (next) => {
			draft = next;
			next.theme = "dark";
			return next;
		});
		if (draft) draft.theme = "mutated";

		expect(state.read(["settings"])).toStrictEqual({ theme: "dark" });
	});

	it("accepts undefined and validates values against the schema", () => {
		const state = setup();

		state.write(["language"], () => undefined);
		expect(state.read(["language"])).toBeUndefined();

		const invalid = unchecked(state);
		expect(() => invalid.write(["language"], () => 1)).toThrow(TypeError);
		expect(state.read(["language"])).toBeUndefined();
	});

	it("rejects values that are not plain data", () => {
		const state = State.fromEntries({ language: new LWWRegister<unknown>("en") });
		expect(() => state.write(["language"], () => () => null)).toThrow(StoreError);
		expect(state.read(["language"])).toBe("en");
	});
});

describe("State row writes", () => {
	it("writes a row, a nested object and a nested field", () => {
		const state = setup();

		state.write(["tickets", "1"], (row) => ({ ...row, title: "Row" }));
		state.write(["tickets", "1", "assignee"], (assignee) => {
			assignee.name = "Nested";
			return assignee;
		});
		state.write(["tickets", "2", "assignee", "name"], () => "Field");

		expect(state.read(["tickets"])).toStrictEqual([
			{ key: "1", title: "Row", assignee: { name: "Nested" } },
			{ key: "2", title: "Second", assignee: { name: "Field" } },
		]);
	});

	it("writes only the addressed row entity", () => {
		const first = new LWWRegister({ key: "1", title: "First" }, "1");
		const second = new LWWRegister({ key: "2", title: "Second" }, "2");
		const state = State.fromEntries({ tickets: new RGA([first, second]) });
		const timestamp = second.timestamp;

		state.write(["tickets", "1", "title"], () => "Changed");

		expect(first.current.title).toBe("Changed");
		expect(second.timestamp).toBe(timestamp);
	});

	it("skips equal rows, including rows made equal by normalization", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);
		const invalid = unchecked(state);

		state.write(["tickets", "1"], (row) => ({ ...row }));
		state.write(["tickets", "1", "title"], (title) => title);
		invalid.write(["tickets", "1"], () => ({ title: "First", assignee: { name: "Ann" }, extra: "dropped" }));

		expect(state.read(["tickets"])).toBe(tickets);
	});

	it("keeps the row key when a recipe tries to change it", () => {
		const state = setup();
		const invalid = unchecked(state);

		invalid.write(["tickets", "1"], () => ({ key: "other", title: "Renamed", assignee: { name: "Ann" } }));

		expect(state.read(["tickets", "1", "title"])).toBe("Renamed");
		expect(state.read(["tickets", "other"])).toBeUndefined();
	});

	it("rejects a missing row before calling the recipe", () => {
		const state = setup();
		const recipe = vi.fn(() => "Ignored");

		expect(() => state.write(["tickets", "missing", "title"], recipe)).toThrow(PathError);
		expect(recipe).not.toHaveBeenCalled();
	});
});

describe("State collection writes", () => {
	it("adds, replaces and removes rows while retaining untouched entities", () => {
		const first = new LWWRegister({ key: "1", title: "First" }, "1");
		const second = new LWWRegister({ key: "2", title: "Second" }, "2");
		const third = new LWWRegister({ key: "3", title: "Third" }, "3");
		const tickets = new RGA([first, second, third]);
		const state = State.fromEntries({ tickets });
		const timestamp = third.timestamp;

		state.write(["tickets"], (rows) => [
			{ ...rows[0], title: "Changed" },
			...rows.slice(2),
			{ key: "4", title: "Added" },
			{ title: "Generated" },
		]);

		expect(tickets.find("1")).toBe(first);
		expect(tickets.find("3")).toBe(third);
		expect(third.timestamp).toBe(timestamp);
		expect(tickets.find("2")).toBeUndefined();
		expect(state.read(["tickets"])).toMatchObject([
			{ key: "1", title: "Changed" },
			{ key: "3", title: "Third" },
			{ key: "4", title: "Added" },
			{ key: expect.any(String), title: "Generated" },
		]);
	});

	it("fills missing schema fields for new rows", () => {
		const state = setup();
		const invalid = unchecked(state);

		invalid.write(["tickets"], () => [{ key: "1", title: "Only title" }]);

		expect(state.read(["tickets"])).toStrictEqual([{ key: "1", title: "Only title", assignee: { name: undefined } }]);
	});

	it("skips unchanged collections and clears them with an empty array", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);

		state.write(["tickets"], (rows) => rows);
		state.write(["tickets"], (rows) => rows.map((row) => ({ ...row })));
		expect(state.read(["tickets"])).toBe(tickets);

		state.write(["tickets"], () => []);
		expect(state.read(["tickets"])).toStrictEqual([]);
	});

	it("rejects duplicate keys, malformed rows and non-array results before writing", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);
		const invalid = unchecked(state);

		expect(() =>
			state.write(["tickets"], (rows) => [
				{ ...rows[0], title: "Changed" },
				{ ...rows[1], key: "1" },
			]),
		).toThrow(StoreError);
		expect(() => invalid.write(["tickets"], () => [{ key: "1", title: 1 }])).toThrow(TypeError);
		expect(() => invalid.write(["tickets"], () => ["row"])).toThrow(StoreError);
		expect(() => invalid.write(["tickets"], () => "rows")).toThrow(StoreError);
		expect(state.read(["tickets"])).toBe(tickets);
	});

	it("applies nothing when the recipe throws", () => {
		const state = setup();
		const tickets = state.read(["tickets"]);

		expect(() =>
			state.write(["tickets"], () => {
				throw new Error("recipe failed");
			}),
		).toThrow("recipe failed");
		expect(state.read(["tickets"])).toBe(tickets);
	});
});

describe("State subscriptions", () => {
	it("notifies once per write with the changed root names", () => {
		const state = setup();
		const listener = vi.fn();
		state.subscribe(listener);

		state.write(["tickets"], (rows) => [
			{ ...rows[0], title: "Changed" },
			{ key: "3", title: "Third", assignee: { name: "Cy" } },
		]);

		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set(["tickets"]));
		expect(state.read(["tickets"])).toHaveLength(2);
	});

	it("stays silent for equal writes and after unsubscribing", () => {
		const state = setup();
		const listener = vi.fn();
		const unsubscribe = state.subscribe(listener);

		state.write(["language"], (language) => language);
		expect(listener).not.toHaveBeenCalled();

		unsubscribe();
		state.write(["language"], () => "cs");
		expect(listener).not.toHaveBeenCalled();
	});

	it("notifies about external entity changes", () => {
		const language = new LWWRegister("en");
		const state = State.fromEntries({ language });
		const listener = vi.fn();
		state.subscribe(listener);

		language.current = "cs";

		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set(["language"]));
	});

	it("delivers writes made by a listener as a separate notification", () => {
		const state = setup();
		const observed: unknown[] = [];
		state.subscribe((changed) => {
			observed.push([...changed]);
			if (state.read(["language"]) === "cs") state.write(["tickets"], () => []);
		});

		state.write(["language"], () => "cs");

		expect(observed).toStrictEqual([["language"], ["tickets"]]);
	});
});

describe("State schema", () => {
	it("rejects unsupported shapes and reserved row fields", () => {
		expect(() => State.fromSchema(object({ count: number() }))).toThrow(TypeError);
		expect(() => State.fromSchema(object({ tags: array(string()) }))).toThrow(TypeError);
		expect(() => State.fromSchema(object({ tickets: array(object({ key: string() })) }))).toThrow(TypeError);
	});

	it("starts registers as defaults without minting timestamps", () => {
		const now = vi.spyOn(Time, "now");
		const state = State.fromSchema(schema);

		expect(state.read(["language"])).toBeUndefined();
		expect(state.read(["tickets"])).toStrictEqual([]);
		expect(now).not.toHaveBeenCalled();
	});

	it("derives public data from the schema", () => {
		expectTypeOf<DataFromSchema<typeof schema>>().toEqualTypeOf<{
			tickets: Array<{ title: string; assignee: { name: string }; key: string }>;
			language: string | undefined;
		}>();
		expectTypeOf<DataFromSchema<ReturnType<typeof object<{ count: ReturnType<typeof number> }>>>>().toEqualTypeOf<{
			count: never;
		}>();
	});

	it("infers readonly views and writable drafts from paths", () => {
		const state = State.fromSchema(
			object({
				tickets: array(object({ assignee: object({ name: string() }), tags: array(string()) })),
				language: string(),
			}),
		);
		expectTypeOf(state.read(["tickets", "missing", "assignee", "name"])).toEqualTypeOf<string | undefined>();
		expectTypeOf(state.read(["tickets", "missing", "tags"])).toEqualTypeOf<readonly string[] | undefined>();
		expectTypeOf(state.read(["tickets", "missing"])).toEqualTypeOf<
			| { readonly assignee: { readonly name: string }; readonly tags: readonly string[]; readonly key: string }
			| undefined
		>();
		state.write(["tickets"], (draft) => {
			draft.push({ key: "1", assignee: { name: "Ann" }, tags: [] });
			return draft;
		});
		state.write(["tickets", "1", "assignee", "name"], (name) => {
			expectTypeOf(name).toEqualTypeOf<string>();
			return "Bob";
		});
		state.write(["tickets", "1"], (draft) => {
			expectTypeOf(draft.assignee.name).toEqualTypeOf<string>();
			draft.tags.push("two");
			return draft;
		});
		expect(state.read(["tickets", "1"])).toStrictEqual({ key: "1", assignee: { name: "Bob" }, tags: ["two"] });
		const invalidCalls = () => {
			// @ts-expect-error A path must start at an entry.
			state.read([]);
			// @ts-expect-error Unknown entry.
			state.read(["unknown"]);
			// @ts-expect-error Rows are addressed by string keys.
			state.read(["tickets", 0]);
			// @ts-expect-error Unknown row field.
			state.read(["tickets", "1", "unknown"]);
			// @ts-expect-error Register-held arrays terminate entity paths.
			state.read(["tickets", "1", "tags", "0"]);
			// @ts-expect-error The updater cannot widen the path's value type.
			state.write(["language"], () => 1);
			// @ts-expect-error Snapshots are readonly.
			state.read(["tickets"]).push({ assignee: { name: "Ann" }, tags: [], key: "2" });
			// @ts-expect-error A recipe has to return the next value.
			state.write(["tickets"], (draft) => {
				draft.push({ key: "2", assignee: { name: "Ann" }, tags: [] });
			});
			state.write(["tickets"], (rows) => {
				// @ts-expect-error New rows require their declared fields.
				rows.push({ key: "2" });
				return rows;
			});
		};
		expectTypeOf(invalidCalls).toBeFunction();
	});
});
