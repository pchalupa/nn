import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { assertArray } from "@nn/guards/assert-array";
import { assertObject } from "@nn/guards/assert-object";
import { afterEach, describe, expect, it, vi } from "vitest";

import { View } from "./view";

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
		const view = new View();

		expect(view.read(root)).toStrictEqual({
			count: 1,
			selection: null,
			missing: undefined,
			rows: [{ title: "A", assignee: { name: "Ann" } }],
		});
	});

	it("keeps a __proto__ field as an own property", () => {
		const root = new LWWMap({ ["__proto__"]: new LWWRegister("saved") });
		const value = new View().read(root);

		assertObject(value);
		expect(Object.hasOwn(value, "__proto__")).toBe(true);
		expect(Object.getOwnPropertyDescriptor(value, "__proto__")?.value).toBe("saved");
	});

	it.each(["root", "rows", "row"])("rejects mutations to the projected %s", (target) => {
		const row = new LWWMap({ title: new LWWRegister("First") });
		const root = new LWWMap({ rows: new RGA([row]) });
		const view = new View();
		const value = view.read(root);

		assertObject(value);
		assertArray(value.rows);
		const first = value.rows[0];

		assertObject(first);
		const container = target === "root" ? value : target === "rows" ? value.rows : first;
		const property = target === "root" ? "rows" : target === "rows" ? "0" : "title";

		expect(Reflect.set(container, property, "Changed")).toBe(false);
		expect(Reflect.deleteProperty(container, property)).toBe(false);
		expect(Reflect.set(container, "extra", true)).toBe(false);
		expect(view.read(root)).toBe(value);
		expect(view.read(root)).toStrictEqual({ rows: [{ title: "First" }] });
	});

	it("records the entity behind each container without tagging it", () => {
		const tags = new RGA([new LWWRegister("red")]);
		const settings = new LWWMap({ tags });
		const view = new View();
		const value = view.read(settings);

		assertObject(value);
		assertArray(value.tags);

		expect(view.identify(value)).toBe(settings);
		expect(view.identify(value.tags)).toBe(tags);
		expect(Reflect.ownKeys(value)).toStrictEqual(["tags"]);
		expect(Reflect.ownKeys(value.tags)).toStrictEqual(["0", "length"]);
		expect(Object.isFrozen(value)).toBe(true);
		expect(value).toStrictEqual({ tags: ["red"] });
	});

	it("reads each entity once and returns the same value while nothing changes", () => {
		const tag = new LWWRegister("red");
		const tags = new RGA([tag]);
		const root = new LWWMap({ tags });
		const view = new View();
		const tagsReads = vi.spyOn(tags, "current", "get");
		const tagReads = vi.spyOn(tag, "current", "get");
		const value = view.read(root);

		expect(view.read(root)).toBe(value);
		expect(tagsReads).toHaveBeenCalledOnce();
		expect(tagReads).toHaveBeenCalledOnce();
	});

	it("rebuilds after a change and leaves earlier values intact", () => {
		const title = new LWWRegister("First");
		const row = new LWWMap({ title });
		const view = new View();
		const before = view.read(row);

		title.current = "Changed";
		const after = view.read(row);

		assertObject(before);
		assertObject(after);

		expect(after).toStrictEqual({ title: "Changed" });
		expect(before).toStrictEqual({ title: "First" });
		expect(view.identify(after)).toBe(row);
		expect(view.identify(before)).toBe(row);
	});

	it("rebuilds only the changed path and reuses everything else", () => {
		const title = new LWWRegister("First");
		const assignee = new LWWMap({ name: new LWWRegister("Ann") });
		const second = new LWWMap({ title: new LWWRegister("Second") });
		const settings = new LWWMap({ theme: new LWWRegister("dark") });
		const tickets = new RGA([new LWWMap({ title, assignee }), second]);
		const root = new LWWMap({ tickets, settings });
		const view = new View();
		const before = view.read(root);
		const secondReads = vi.spyOn(second, "current", "get");
		const assigneeReads = vi.spyOn(assignee, "current", "get");
		const settingsReads = vi.spyOn(settings, "current", "get");

		title.current = "Changed";
		const after = view.read(root);

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
		const view = new View();
		const before = view.read(rows);

		rows.remove(first.key);
		rows.push(new LWWMap({ title: new LWWRegister("Replacement") }, "replacement"));
		const after = view.read(rows);

		assertArray(before);
		assertArray(after);

		expect(after).toStrictEqual([{ title: "Second" }, { title: "Replacement" }]);
		expect(after[0]).toBe(before[1]);
	});

	it("reads unchanged registers again when their parent rebuilds", () => {
		const title = new LWWRegister("First");
		const done = new LWWRegister(false);
		const root = new LWWMap({ title, done });
		const view = new View();

		void view.read(root);
		const doneReads = vi.spyOn(done, "current", "get");

		title.current = "Changed";

		expect(view.read(root)).toStrictEqual({ title: "Changed", done: false });
		expect(doneReads).toHaveBeenCalledOnce();
	});

	it("keeps non-entity values by reference", () => {
		const label = { text: "red" };
		const value = new View().read(new LWWMap({ tag: new LWWRegister({ label }) }));

		assertObject(value);
		assertObject(value.tag);

		expect(value.tag.label).toBe(label);
		label.text = "blue";
		expect(value.tag.label).toStrictEqual({ text: "blue" });
	});
});
