import { describe, expect, it } from "vitest";

import { isString } from "./is-string";

describe("isString", () => {
	it("accepts strings and rejects other values", () => {
		expect(isString("abc")).toBe(true);
		expect(isString(new String("abc"))).toBe(false);
		expect(isString(1)).toBe(false);
	});
});
