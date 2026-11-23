import { describe, expect, it } from "vitest";

import { assertArray } from "./assert-array";

describe("assertArray", () => {
	it("accepts an array", () => {
		expect(() => assertArray([1, "a"])).not.toThrow();
	});

	it("rejects an array-like", () => {
		expect(() => assertArray({ length: 0 })).toThrow("Expected an array.");
	});

	it("throws the given message", () => {
		expect(() => assertArray(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
