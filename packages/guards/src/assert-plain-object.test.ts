import { describe, expect, it } from "vitest";

import { assertPlainObject } from "./assert-plain-object";

describe("assertPlainObject", () => {
	it("accepts a plain object", () => {
		expect(() => assertPlainObject({ a: 1 })).not.toThrow();
	});

	it("rejects a class instance", () => {
		expect(() => assertPlainObject(new Map())).toThrow("Expected a plain object.");
	});

	it("throws the given message", () => {
		expect(() => assertPlainObject(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
