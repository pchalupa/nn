import { describe, expect, it } from "vitest";

import { assertString } from "./assert-string";

describe("assertString", () => {
	it("accepts a string", () => {
		expect(() => assertString("abc")).not.toThrow();
	});

	it("rejects a number", () => {
		expect(() => assertString(1)).toThrow("Expected a string.");
	});

	it("throws the given message", () => {
		expect(() => assertString(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
