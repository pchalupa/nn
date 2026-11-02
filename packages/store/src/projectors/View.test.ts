import type { Entity } from "@nn/entities/Entity";
import { LWWMap } from "@nn/entities/kinds/LWWMap";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { assertArray } from "@nn/guards/assertArray";
import { assertObject } from "@nn/guards/assertObject";
import { afterEach, describe, expect, it, vi } from "vitest";

import { View } from "./View";

describe("View", () => {
	afterEach(() => vi.restoreAllMocks());

	it("materializes entities into plain values", () => {
		const row = new LWWMap({ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) });
		const root = new LWWMap({
			count: new LWWRegister(1),
			selection: new LWWRegister<string | null>(null),
			missing: new LWWRegister(undefined),
			rows: new RGA([row]),
		});
		const view = new View(root, new WeakMap<object, Entity>());

		expect(view.value).toStrictEqual({
			count: 1,
			selection: null,
			missing: undefined,
			rows: [{ title: "A", assignee: { name: "Ann" } }],
		});
	});

	it.each(["root", "rows", "row"])("rejects mutations to the projected %s", (target) => {
		const row = new LWWMap({ title: new LWWRegister("First") });
		const view = new View(new LWWMap({ rows: new RGA([row]) }), new WeakMap<object, Entity>());
		const value = view.value;

		assertObject(value);
		assertArray(value.rows);
		const first = value.rows[0];

		assertObject(first);
		const container = target === "root" ? value : target === "rows" ? value.rows : first;
		const property = target === "root" ? "rows" : target === "rows" ? "0" : "title";

		expect(Reflect.set(container, property, "Changed")).toBe(false);
		expect(Reflect.deleteProperty(container, property)).toBe(false);
		expect(Reflect.set(container, "extra", true)).toBe(false);
		expect(view.value).toBe(value);
		expect(view.value).toStrictEqual({ rows: [{ title: "First" }] });
	});

	it("maps each container to its entity", () => {
		const tags = new RGA([new LWWRegister("red")]);
		const settings = new LWWMap({ tags });
		const entities = new WeakMap<object, Entity>();
		const value = new View(settings, entities).value;

		assertObject(value);
		assertArray(value.tags);

		expect(entities.get(value)).toBe(settings);
		expect(entities.get(value.tags)).toBe(tags);
	});

	it("reads each entity once and returns the same value while nothing changes", () => {
		const tag = new LWWRegister("red");
		const tags = new RGA([tag]);
		const view = new View(new LWWMap({ tags }), new WeakMap<object, Entity>());
		const tagsReads = vi.spyOn(tags, "current", "get");
		const tagReads = vi.spyOn(tag, "current", "get");
		const value = view.value;

		expect(view.value).toBe(value);
		expect(tagsReads).toHaveBeenCalledOnce();
		expect(tagReads).toHaveBeenCalledOnce();
	});

	it("rebuilds after a change and leaves earlier values intact", () => {
		const title = new LWWRegister("First");
		const row = new LWWMap({ title });
		const entities = new WeakMap<object, Entity>();
		const view = new View(row, entities);
		const before = view.value;

		title.current = "Changed";
		const after = view.value;

		assertObject(before);
		assertObject(after);

		expect(after).toStrictEqual({ title: "Changed" });
		expect(before).toStrictEqual({ title: "First" });
		expect(entities.get(after)).toBe(row);
		expect(entities.get(before)).toBe(row);
	});

	it("rebuilds only the changed path and reuses everything else", () => {
		const title = new LWWRegister("First");
		const assignee = new LWWMap({ name: new LWWRegister("Ann") });
		const second = new LWWMap({ title: new LWWRegister("Second") });
		const settings = new LWWMap({ theme: new LWWRegister("dark") });
		const tickets = new RGA([new LWWMap({ title, assignee }), second]);
		const view = new View(new LWWMap({ tickets, settings }), new WeakMap<object, Entity>());
		const before = view.value;
		const secondReads = vi.spyOn(second, "current", "get");
		const assigneeReads = vi.spyOn(assignee, "current", "get");
		const settingsReads = vi.spyOn(settings, "current", "get");

		title.current = "Changed";
		const after = view.value;

		assertObject(before);
		assertObject(after);
		assertArray(before.tickets);
		assertArray(after.tickets);

		const [beforeFirst, beforeSecond] = before.tickets;
		const [afterFirst, afterSecond] = after.tickets;

		assertObject(beforeFirst);
		assertObject(afterFirst);

		expect(afterFirst.title).toBe("Changed");
		expect(after.tickets).not.toBe(before.tickets);
		expect(afterSecond).toBe(beforeSecond);
		expect(afterFirst.assignee).toBe(beforeFirst.assignee);
		expect(after.settings).toBe(before.settings);
		expect(secondReads).not.toHaveBeenCalled();
		expect(assigneeReads).not.toHaveBeenCalled();
		expect(settingsReads).not.toHaveBeenCalled();
	});

	it("reuses surviving rows at their new positions", () => {
		const first = new LWWMap({ title: new LWWRegister("First") }, "first");
		const rows = new RGA([first, new LWWMap({ title: new LWWRegister("Second") })]);
		const view = new View(rows, new WeakMap<object, Entity>());
		const before = view.value;

		rows.remove(first.key);
		rows.push(new LWWMap({ title: new LWWRegister("Replacement") }, "first"));
		const after = view.value;

		assertArray(before);
		assertArray(after);

		expect(after).toStrictEqual([{ title: "Second" }, { title: "Replacement" }]);
		expect(after[0]).toBe(before[1]);
	});

	it("reads unchanged registers again when their parent rebuilds", () => {
		const title = new LWWRegister("First");
		const done = new LWWRegister(false);
		const view = new View(new LWWMap({ title, done }), new WeakMap<object, Entity>());

		void view.value;
		const doneReads = vi.spyOn(done, "current", "get");

		title.current = "Changed";

		expect(view.value).toStrictEqual({ title: "Changed", done: false });
		expect(doneReads).toHaveBeenCalledOnce();
	});

	it("keeps non-entity values by reference", () => {
		const label = { text: "red" };
		const value = new View(new LWWMap({ tag: new LWWRegister({ label }) }), new WeakMap<object, Entity>()).value;

		assertObject(value);
		assertObject(value.tag);

		expect(value.tag.label).toBe(label);
		label.text = "blue";
		expect(value.tag.label).toStrictEqual({ text: "blue" });
	});
});
