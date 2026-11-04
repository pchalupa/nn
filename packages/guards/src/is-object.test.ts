import { describe, expect, it } from "vitest";

import { isObject } from "./is-object";

describe("isObject", () => {
	it("accepts non-null objects and rejects primitives", () => {
		expect(isObject({})).toBe(true);
		expect(isObject([])).toBe(true);
		expect(isObject(new Map())).toBe(true);
		expect(isObject(null)).toBe(false);
		expect(isObject(undefined)).toBe(false);
		expect(isObject("a")).toBe(false);
		expect(isObject(() => undefined)).toBe(false);
	});
});
