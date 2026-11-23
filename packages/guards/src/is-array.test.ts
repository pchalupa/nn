import { describe, expect, it } from "vitest";

import { isArray } from "./is-array";

describe("isArray", () => {
	it("accepts arrays and rejects array-likes", () => {
		expect(isArray([1, "a"])).toBe(true);
		expect(isArray({ length: 0 })).toBe(false);
	});
});
