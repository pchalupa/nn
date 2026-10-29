import { LWWMap } from "@nn/entities/LWWMap";
import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import { describe, expect, expectTypeOf, it } from "vitest";

import { View } from "./View";

describe("View", () => {
	it("materializes array items", () => {
		const row = new LWWMap(
			{ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) },
			"row-1",
		);
		const array = new RGA([row], "tickets");
		const view = new View(array);
		const rows = view.value;

		expectTypeOf(rows).toEqualTypeOf<Array<{ title: string; assignee: { name: string } }>>();
		expect(rows).toStrictEqual([{ title: "A", assignee: { name: "Ann" } }]);
	});

	it("infers map fields", () => {
		const row = new LWWMap(
			{ title: new LWWRegister("A"), assignee: new LWWMap({ name: new LWWRegister("Ann") }) },
			"row-1",
		);
		const view = new View(
			new LWWMap({
				count: new LWWRegister(1),
				enabled: new LWWRegister(true),
				selection: new LWWRegister<string | null>(null),
				missing: new LWWRegister(undefined),
				rows: new RGA([row]),
			}),
		);

		expectTypeOf(view.value).toEqualTypeOf<{
			count: number;
			enabled: boolean;
			selection: string | null;
			missing: undefined;
			rows: Array<{ title: string; assignee: { name: string } }>;
		}>();
		expect(view.value).toStrictEqual({
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
		const view = new View(collection);
		const before = view.value;

		row.current.title.current = "B";

		expect(view.value).toBe(before);

		view.invalidate();

		expect(view.value).not.toBe(before);
		expect(view.value).toStrictEqual([{ title: "B", assignee: { name: "Ann" } }]);
	});
});
