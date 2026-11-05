import { describe, expect, it } from "vitest";

import { isString } from "./is-string";

describe("isString", () => {
	it("accepts strings and rejects other values", () => {
		expect(isString("")).toBe(true);
		expect(isString("abc")).toBe(true);
		expect(isString(new String("abc"))).toBe(false);
		expect(isString(1)).toBe(false);
		expect(isString(null)).toBe(false);
		expect(isString(undefined)).toBe(false);
	});
});
