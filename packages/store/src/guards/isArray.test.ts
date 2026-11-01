import { describe, expect, it } from "vitest";

import { isArray } from "./isArray";

describe("isArray", () => {
	it("accepts arrays and rejects array-likes", () => {
		expect(isArray([])).toBe(true);
		expect(isArray([1, "a"])).toBe(true);
		expect(isArray({ length: 0 })).toBe(false);
		expect(isArray("abc")).toBe(false);
		expect(isArray(null)).toBe(false);
	});
});
