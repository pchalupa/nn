import { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { assertArray } from "@nn/guards/assert-array";
import { assertObject } from "@nn/guards/assert-object";
import { isObject } from "@nn/guards/is-object";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Draft } from "./draft";
import { View } from "./view";

const at = (value: unknown, ...path: PropertyKey[]): unknown => {
	let current = value;

	for (const key of path) current = isObject(current) ? Reflect.get(current, key) : undefined;

	return current;
};

const row = (title: string) =>
	new LWWMap(
		{
			title: new LWWRegister(title, "title"),
			assignee: new LWWMap({ name: new LWWRegister("Ann", "name") }, "assignee"),
		},
		title,
	);

const fixture = () => {
	const rows = new RGA([row("A"), row("B"), row("C")], "rows");
	const root = new LWWMap({ rows, language: new LWWRegister("en", "language") }, "root");
	const draft = new Draft(root, new View());

	return { rows, root, draft };
};

describe("Draft", () => {
	afterEach(() => vi.restoreAllMocks());

	it("copies an entity tree independently and knows the entity behind each copy", () => {
		const tags = new RGA([new LWWRegister("red", "first")], "tags");
		const settings = new LWWMap({ tags }, "settings");
		const draft = new Draft(settings, new View());
		const copy = draft.value;

		expect(copy).toStrictEqual({ tags: ["red"] });

		assertObject(copy);
		assertArray(copy.tags);

		expect(draft.identify(copy)).toBe(settings);
		expect(draft.identify(copy.tags)).toBe(tags);
		expect(new Draft(settings, new View()).value).not.toBe(copy);
	});

	it("knows the entity behind a draft list and none behind a foreign object", () => {
		const { rows, draft } = fixture();
		const copy = draft.value;
		const list = at(copy, "rows");

		assertObject(list);

		expect(draft.identify(list)).toBe(rows);
		expect(draft.identify({})).toBeUndefined();
	});

	it("knows the entity behind draft objects without exposing it", () => {
		const { rows, root, draft } = fixture();
		const copy = draft.value;
		const list = at(copy, "rows");
		const first = at(copy, "rows", 0);

		assertObject(copy);
		assertObject(list);
		assertObject(first);

		expect(draft.identify(copy)).toBe(root);
		expect(draft.identify(list)).toBe(rows);
		expect(draft.identify(first)).toBe(rows.current[0]);
		expect(Reflect.ownKeys(first)).toStrictEqual(["title", "assignee"]);
		expect(draft.identify({ ...first })).toBeUndefined();
	});

	it("reads one row without reading the other rows", () => {
		const { draft } = fixture();
		const lists = vi.spyOn(RGA.prototype, "current", "get");
		const maps = vi.spyOn(LWWMap.prototype, "current", "get");

		expect(at(draft.value, "rows", 1, "title")).toBe("B");
		expect(lists).toHaveBeenCalledOnce();
		expect(maps.mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("answers length without reading the list", () => {
		const { draft } = fixture();
		const lists = vi.spyOn(RGA.prototype, "current", "get");

		expect(at(draft.value, "rows", "length")).toBe(3);
		expect(lists).not.toHaveBeenCalled();
	});

	it.each(["01", "-1", "1.0", "3"])("treats only canonical indexes below the length as rows (%s)", (key) => {
		const { draft } = fixture();

		expect(at(draft.value, "rows", key)).toBeUndefined();
	});

	it("returns the same row draft before and after the list fills", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const first = at(copy, "rows", 0);
		const list = at(copy, "rows");

		assertObject(list);
		Object.keys(list);

		expect(at(copy, "rows", 0)).toBe(first);
	});

	it("hands out row drafts, never entities, for rows a filled list has not read", () => {
		const { rows, draft } = fixture();
		const list = at(draft.value, "rows");

		assertArray(list);
		Object.keys(list);

		const reads = [
			list[2],
			[...list][1],
			list.slice(0)[0],
			Object.getOwnPropertyDescriptor(list, "1")?.value,
			Object.values(list)[2],
		];

		for (const value of reads) {
			expect(Entity.is(value)).toBe(false);
			assertObject(value);
			expect(draft.identify(value)).toBeDefined();
		}

		expect(draft.identify(list[2] ?? {})).toBe(rows.current[2]);
		expect(list.slice(0)).toStrictEqual(["A", "B", "C"].map((title) => ({ title, assignee: { name: "Ann" } })));
	});

	it("tells a write to a row apart from a write to its list", () => {
		const { draft } = fixture();
		const list = at(draft.value, "rows");

		assertArray(list);

		const found = list.find((entry) => at(entry, "title") === "B");

		assertObject(found);
		Reflect.set(found, "title", "Bo");

		expect(draft.inspect(list)).toMatchObject({ modified: true, written: false, changed: [draft.inspect(found)] });

		Reflect.set(list, list.length, { title: "D", assignee: { name: "Ann" } });

		expect(draft.inspect(list)?.written).toBe(true);
	});

	it("behaves like plain data", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const plain = {
			rows: ["A", "B", "C"].map((title) => ({ title, assignee: { name: "Ann" } })),
			language: "en",
		};

		expect(copy).toStrictEqual(plain);
		expect(Array.isArray(at(copy, "rows"))).toBe(true);
		expect(JSON.parse(JSON.stringify(copy))).toStrictEqual(plain);
	});

	it("marks a written object and its ancestors, not its siblings", () => {
		const { rows, draft } = fixture();
		const copy = draft.value;
		const assignee = at(copy, "rows", 1, "assignee");

		assertObject(assignee);
		Reflect.set(assignee, "name", "Bo");

		for (const value of [assignee, at(copy, "rows", 1), at(copy, "rows"), copy]) {
			expect(draft.inspect(value)?.modified).toBe(true);
		}

		expect(draft.inspect(at(copy, "rows", 0))?.modified).toBe(false);
		expect(rows.current[1]?.encode()).toMatchObject({ data: { assignee: { data: { name: { data: "Ann" } } } } });
	});

	it("copies object-valued registers shallowly", () => {
		const meta = new LWWRegister({ tags: ["a"] }, "meta");
		const draft = new Draft(new LWWMap({ meta }, "root"), new View());
		const copy = draft.value;

		expect(at(copy, "meta")).not.toBe(meta.current);
		expect(at(copy, "meta")).toStrictEqual({ tags: ["a"] });
	});

	it("fills an unfilled draft when its entity is filled", () => {
		const { rows, draft } = fixture();
		const list = at(draft.value, "rows");

		draft.fill(rows);
		rows.push(row("D"));

		expect(at(list, "length")).toBe(3);
	});

	it("fills only its own objects", () => {
		const { rows, root, draft: outer } = fixture();
		const outerRows = at(outer.value, "rows");
		const inner = new Draft(root, new View());

		at(inner.value, "rows");
		inner.fill(rows);

		expect(outer.inspect(outerRows)?.filled).toBe(false);
	});

	it("does not recognize objects of another draft", () => {
		const { root, draft } = fixture();
		const other = new Draft(root, new View());

		expect(draft.inspect(other.value)).toBeUndefined();
	});

	it("does not write through to its entity", () => {
		const { root, draft } = fixture();
		const copy = draft.value;

		assertObject(copy);

		expect(() => Reflect.set(copy, "language", "cs")).not.toThrow();
		expect(root.get("language")?.current).toBe("en");
	});

	it("keeps an unread row and list readable after they are frozen", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const list = at(copy, "rows");
		const first = at(copy, "rows", 0);

		assertObject(list);
		assertObject(first);
		Object.freeze(first);
		Object.freeze(list);

		expect(at(first, "title")).toBe("A");
		expect(at(list, "length")).toBe(3);
		expect(Object.isFrozen(first)).toBe(true);
	});
});
