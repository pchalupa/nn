import { describe, expect, it } from "vitest";

import { assertArray } from "./assert-array";

describe("assertArray", () => {
	it("accepts arrays", () => {
		expect(() => assertArray([])).not.toThrow();
		expect(() => assertArray([1, "a"])).not.toThrow();
	});

	it.each([{ length: 0 }, "abc", null])("rejects %o", (value) => {
		expect(() => assertArray(value)).toThrow("Expected an array.");
	});

	it("throws the given message", () => {
		expect(() => assertArray(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
