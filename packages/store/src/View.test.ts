import { LWWMap } from "@nn/entities/kinds/LWWMap";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { EntityMapping } from "./EntityMapping";
import { View } from "./View";

describe("View", () => {
	afterEach(() => vi.restoreAllMocks());

	it("builds the view and maps its containers in one traversal", () => {
		const first = new LWWRegister("red", "first");
		const second = new LWWRegister("red", "second");
		const tags = new RGA([first, second], "tags");
		const settings = new LWWMap({ tags }, "settings");
		const mapping = new EntityMapping();
		const projection = new View(settings, mapping);
		const reads = vi.spyOn(tags, "current", "get");
		const firstReads = vi.spyOn(first, "current", "get");
		const secondReads = vi.spyOn(second, "current", "get");
		const value = projection.value;

		expect(value).toStrictEqual({ tags: ["red", "red"] });
		expect(mapping.get(value)).toBe(settings);
		expect(mapping.get(value.tags)).toBe(tags);
		expect(projection.value).toBe(value);
		expect(mapping.get(projection.value)).toBe(settings);
		expect(reads).toHaveBeenCalledTimes(1);
		expect(firstReads).toHaveBeenCalledTimes(1);
		expect(secondReads).toHaveBeenCalledTimes(1);
	});

	it("invalidates value and node together while retaining older mappings", () => {
		const title = new LWWRegister("First", "title");
		const row = new LWWMap({ title }, "row");
		const mapping = new EntityMapping();
		const projection = new View(row, mapping);
		const value = projection.value;

		title.current = "Changed";

		expect(projection.value).toBe(value);

		projection.invalidate();

		expect(projection.value).not.toBe(value);
		expect(projection.value).toStrictEqual({ title: "Changed" });
		expect(mapping.get(value)).toBe(row);
		expect(mapping.get(projection.value)).toBe(row);
		expect(value).toStrictEqual({ title: "First" });
	});

	it("rebuilds changed ancestors while reusing unchanged child values and nodes", () => {
		const title = new LWWRegister("First", "title");
		const assignee = new LWWMap({ name: new LWWRegister("Ann", "name") }, "assignee");
		const first = new LWWMap({ title, assignee }, "first");
		const second = new LWWMap(
			{
				title: new LWWRegister("Second", "title"),
				assignee: new LWWMap({ name: new LWWRegister("Bob", "name") }, "assignee"),
			},
			"second",
		);
		const tickets = new RGA([first, second], "tickets");
		const settings = new LWWMap({ theme: new LWWRegister("dark", "theme") }, "settings");
		const root = new LWWMap({ tickets, settings }, "state");
		const mapping = new EntityMapping();
		const projection = new View(root, mapping);
		const before = projection.value;
		const siblingReads = vi.spyOn(second, "current", "get");
		const assigneeReads = vi.spyOn(assignee, "current", "get");
		const settingsReads = vi.spyOn(settings, "current", "get");

		title.current = "Changed";
		projection.invalidate();
		const after = projection.value;

		expect(after).not.toBe(before);
		expect(after.tickets).not.toBe(before.tickets);
		expect(after.tickets[0]).not.toBe(before.tickets[0]);
		expect(after.tickets[1]).toBe(before.tickets[1]);
		expect(after.tickets[0].assignee).toBe(before.tickets[0].assignee);
		expect(after.settings).toBe(before.settings);
		expect(mapping.get(after.tickets[0].assignee)).toBe(assignee);
		expect(mapping.get(after.settings)).toBe(settings);
		expect(mapping.get(after.tickets[1])).toBe(second);
		expect(mapping.get(after)).toBe(root);
		expect(mapping.get(before)).toBe(root);
		expect(after.tickets[0].title).toBe("Changed");
		expect(before.tickets[0].title).toBe("First");
		expect(siblingReads).not.toHaveBeenCalled();
		expect(assigneeReads).not.toHaveBeenCalled();
		expect(settingsReads).not.toHaveBeenCalled();
	});

	it("reuses surviving row projections at new positions after collection changes", () => {
		const first = new LWWMap({ title: new LWWRegister("First") }, "first");
		const second = new LWWMap({ title: new LWWRegister("Second") }, "second");
		const rows = new RGA([first, second], "rows");
		const mapping = new EntityMapping();
		const projection = new View(rows, mapping);
		const before = projection.value;

		rows.remove(first.key);
		rows.push(new LWWMap({ title: new LWWRegister("Replacement") }, "first"));
		projection.invalidate();
		const after = projection.value;

		expect(after).toStrictEqual([{ title: "Second" }, { title: "Replacement" }]);
		expect(after[0]).toBe(before[1]);
		expect(after[1]).not.toBe(before[0]);
		expect(mapping.get(after[0])).toBe(second);
		expect(mapping.get(before[0])).toBe(first);
		expect(mapping.get(after[1])).toBe(rows.current[1]);
		expect(mapping.get(after[1])).not.toBe(first);
	});

	it("reads an unchanged register again instead of caching it when its parent rebuilds", () => {
		const title = new LWWRegister("First", "title");
		const done = new LWWRegister(false, "done");
		const row = new LWWMap({ title, done }, "row");
		const projection = new View(row, new EntityMapping());

		void projection.value;
		const reads = vi.spyOn(done, "current", "get");

		title.current = "Changed";
		projection.invalidate();

		expect(projection.value).toStrictEqual({ title: "Changed", done: false });
		expect(reads).toHaveBeenCalledOnce();
	});

	it("caches a scalar projection even when the projected value is undefined", () => {
		const entity = new LWWRegister(undefined);
		const mapping = new EntityMapping();
		const projection = new View(entity, mapping);
		const reads = vi.spyOn(entity, "current", "get");

		expect(projection.value).toBeUndefined();
		expect(projection.value).toBeUndefined();
		expect(reads).toHaveBeenCalledTimes(1);
	});

	it("materializes array items", () => {
		const row = new LWWMap(
			{ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) },
			"row-1",
		);
		const array = new RGA([row], "tickets");
		const mapping = new EntityMapping();
		const projection = new View(array, mapping);
		const rows = projection.value;

		expectTypeOf(rows).toEqualTypeOf<Array<{ title: string; assignee: { name: string } }>>();
		expect(rows).toStrictEqual([{ title: "A", assignee: { name: "Ann" } }]);
	});

	it("infers map fields", () => {
		const row = new LWWMap(
			{ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) },
			"row-1",
		);
		const mapping = new EntityMapping();
		const projection = new View(
			new LWWMap({
				count: new LWWRegister(1),
				enabled: new LWWRegister(true),
				selection: new LWWRegister<string | null>(null),
				missing: new LWWRegister(undefined),
				rows: new RGA([row]),
			}),
			mapping,
		);

		expectTypeOf(projection.value).toEqualTypeOf<{
			count: number;
			enabled: boolean;
			selection: string | null;
			missing: undefined;
			rows: Array<{ title: string; assignee: { name: string } }>;
		}>();
		expect(projection.value).toStrictEqual({
			count: 1,
			enabled: true,
			selection: null,
			missing: undefined,
			rows: [{ title: "A", assignee: { name: "Ann" } }],
		});
	});

	it("materializes once until invalidated", () => {
		const row = new LWWMap(
			{ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) },
			"row-1",
		);
		const collection = new RGA([row], "tickets");
		const mapping = new EntityMapping();
		const projection = new View(collection, mapping);
		const before = projection.value;

		row.current.title.current = "B";

		expect(projection.value).toBe(before);

		projection.invalidate();

		expect(projection.value).not.toBe(before);
		expect(projection.value).toStrictEqual([{ title: "B", assignee: { name: "Ann" } }]);
	});
});
