import { describe, expect, it } from "vitest";

import { equal } from "./equal";

describe("equal", () => {
	it.each([
		{ left: NaN, right: NaN, expected: true },
		{ left: 0, right: -0, expected: false },
		{ left: { value: undefined }, right: {}, expected: false },
		{ left: { a: 1, b: 2 }, right: { b: 2, a: 1 }, expected: true },
		{ left: Array(1), right: [undefined], expected: false },
		{ left: [], right: Array(1), expected: false },
		{ left: { nested: [1] }, right: { nested: [2] }, expected: false },
		{ left: [], right: {}, expected: false },
		{ left: null, right: {}, expected: false },
		{ left: new Date(0), right: new Date(0), expected: false },
	])("compares $left and $right as $expected", ({ left, right, expected }) => {
		expect(equal(left, right)).toBe(expected);
		expect(equal(right, left)).toBe(expected);
	});

	it("compares null-prototype records by their own properties", () => {
		const value = { title: "First" };

		Object.setPrototypeOf(value, null);

		expect(equal(value, { title: "First" })).toBe(true);
		expect(equal(value, { title: "Second" })).toBe(false);
	});

	it("compares nested items field by field", () => {
		const items = [{ key: "1", title: "First", assignee: { name: "Ann" } }];

		expect(equal(items, structuredClone(items))).toBe(true);
		expect(equal(items, [{ key: "1", title: "First", assignee: { name: "Bob" } }])).toBe(false);
		expect(equal(items, [])).toBe(false);
	});
});
