import { describe, expect, it } from "vitest";

import { assertString } from "./assert-string";

describe("assertString", () => {
	it("accepts strings", () => {
		expect(() => assertString("")).not.toThrow();
		expect(() => assertString("abc")).not.toThrow();
	});

	it.each([new String("abc"), 1, null, undefined])("rejects %o", (value) => {
		expect(() => assertString(value)).toThrow("Expected a string.");
	});
});
