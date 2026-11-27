import { Entity } from "@goodstate/entities/entity";
import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";
import { RGA } from "@goodstate/entities/kinds/rga";
import { assertArray } from "@goodstate/guards/assert-array";
import { assertObject } from "@goodstate/guards/assert-object";
import { isObject } from "@goodstate/guards/is-object";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Draft } from "./draft";
import { View } from "./view";

const at = (value: unknown, ...path: PropertyKey[]): unknown => {
	let current = value;

	for (const key of path) current = isObject(current) ? Reflect.get(current, key) : undefined;

	return current;
};

const item = (title: string) =>
	new LWWMap(
		{
			title: new LWWRegister(title, "title"),
			assignee: new LWWMap({ name: new LWWRegister("Ann", "name") }, "assignee"),
		},
		title,
	);

const fixture = () => {
	const items = new RGA([item("A"), item("B"), item("C")], "items");
	const root = new LWWMap({ items, language: new LWWRegister("en", "language") }, "root");
	const draft = new Draft(root, new View());

	return { items, root, draft };
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

	it("knows the entity behind draft objects without exposing it", () => {
		const { items, root, draft } = fixture();
		const copy = draft.value;
		const list = at(copy, "items");
		const first = at(copy, "items", 0);

		assertObject(copy);
		assertObject(list);
		assertObject(first);

		expect(draft.identify(copy)).toBe(root);
		expect(draft.identify(list)).toBe(items);
		expect(draft.identify(first)).toBe(items.current[0]);
		expect(Reflect.ownKeys(first)).toStrictEqual(["title", "assignee"]);
		expect(draft.identify({ ...first })).toBeUndefined();
	});

	it("reads one item without reading the other items", () => {
		const { draft } = fixture();
		const lists = vi.spyOn(RGA.prototype, "current", "get");
		const maps = vi.spyOn(LWWMap.prototype, "current", "get");

		expect(at(draft.value, "items", 1, "title")).toBe("B");
		expect(lists).toHaveBeenCalledOnce();
		expect(maps.mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("answers length without reading the list", () => {
		const { draft } = fixture();
		const lists = vi.spyOn(RGA.prototype, "current", "get");

		expect(at(draft.value, "items", "length")).toBe(3);
		expect(lists).not.toHaveBeenCalled();
	});

	it.each(["01", "-1", "1.0", "3"])("treats only canonical indexes below the length as items (%s)", (key) => {
		const { draft } = fixture();

		expect(at(draft.value, "items", key)).toBeUndefined();
	});

	it("returns the same item draft before and after the list fills", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const first = at(copy, "items", 0);
		const list = at(copy, "items");

		assertObject(list);
		Object.keys(list);

		expect(at(copy, "items", 0)).toBe(first);
	});

	it("hands out item drafts, never entities, for items a filled list has not read", () => {
		const { items, draft } = fixture();
		const list = at(draft.value, "items");

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

		expect(draft.identify(list[2] ?? {})).toBe(items.current[2]);
		expect(list.slice(0)).toStrictEqual(["A", "B", "C"].map((title) => ({ title, assignee: { name: "Ann" } })));
	});

	it("resolves an unread item of a filled list to its draft", () => {
		const { items, draft } = fixture();
		const list = at(draft.value, "items");

		draft.fill(items);

		const placeholder = at(draft.inspect(list)?.target, 1);

		expect(Entity.is(placeholder)).toBe(true);

		const resolved = draft.resolve(placeholder, list, 1);

		expect(Entity.is(resolved)).toBe(false);
		assertObject(resolved);
		expect(draft.identify(resolved)).toBe(items.current[1]);
		expect(resolved).toStrictEqual({ title: "B", assignee: { name: "Ann" } });
	});

	it("resolves a plain value to itself", () => {
		const { draft } = fixture();
		const value = { title: "A" };

		expect(draft.resolve(value, { item: value }, "item")).toBe(value);
		expect(draft.resolve("A", ["A"], 0)).toBe("A");
	});

	it("tells a write to an item apart from a write to its list", () => {
		const { draft } = fixture();
		const list = at(draft.value, "items");

		assertArray(list);

		const found = list.find((entry) => at(entry, "title") === "B");

		assertObject(found);
		Reflect.set(found, "title", "Bo");

		expect(draft.inspect(list)).toMatchObject({ dirty: true, written: false, changed: [draft.inspect(found)] });

		Reflect.set(list, list.length, { title: "D", assignee: { name: "Ann" } });

		expect(draft.inspect(list)?.written).toBe(true);
	});

	it("keeps a __proto__ field as an own property", () => {
		const root = new LWWMap({ ["__proto__"]: new LWWRegister("saved") });
		const value = new Draft(root, new View()).value;

		assertObject(value);
		expect(Object.hasOwn(value, "__proto__")).toBe(true);
		expect(Object.getOwnPropertyDescriptor(value, "__proto__")?.value).toBe("saved");
	});

	it("behaves like plain data", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const plain = {
			items: ["A", "B", "C"].map((title) => ({ title, assignee: { name: "Ann" } })),
			language: "en",
		};

		expect(copy).toStrictEqual(plain);
		expect(Array.isArray(at(copy, "items"))).toBe(true);
		expect(JSON.parse(JSON.stringify(copy))).toStrictEqual(plain);
	});

	it("marks a written object and its ancestors, not its siblings", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const assignee = at(copy, "items", 1, "assignee");

		assertObject(assignee);
		Reflect.set(assignee, "name", "Bo");

		for (const value of [assignee, at(copy, "items", 1), at(copy, "items"), copy]) {
			expect(draft.inspect(value)?.dirty).toBe(true);
		}

		expect(draft.inspect(at(copy, "items", 0))?.dirty).toBe(false);
	});

	it("copies object-valued registers shallowly", () => {
		const meta = new LWWRegister({ tags: ["a"] }, "meta");
		const draft = new Draft(new LWWMap({ meta }, "root"), new View());
		const copy = draft.value;

		expect(at(copy, "meta")).not.toBe(meta.current);
		expect(at(copy, "meta")).toStrictEqual({ tags: ["a"] });
	});

	it("fills an unfilled draft when its entity is filled", () => {
		const { items, draft } = fixture();
		const list = at(draft.value, "items");

		draft.fill(items);
		items.push(item("D"));

		expect(at(list, "length")).toBe(3);
	});

	it("fills only its own objects", () => {
		const { items, root, draft: outer } = fixture();
		const outerItems = at(outer.value, "items");
		const inner = new Draft(root, new View());

		at(inner.value, "items");
		inner.fill(items);

		expect(outer.inspect(outerItems)?.filled).toBe(false);
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

	it("keeps an unread item and list readable after they are frozen", () => {
		const { draft } = fixture();
		const copy = draft.value;
		const list = at(copy, "items");
		const first = at(copy, "items", 0);

		assertObject(list);
		assertObject(first);
		Object.freeze(first);
		Object.freeze(list);

		expect(at(first, "title")).toBe("A");
		expect(at(list, "length")).toBe(3);
		expect(Object.isFrozen(first)).toBe(true);
	});
});
