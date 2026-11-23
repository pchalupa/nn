import { describe, expect, it } from "vitest";

import { assertObject } from "./assert-object";

describe("assertObject", () => {
	it("accepts an object", () => {
		expect(() => assertObject({})).not.toThrow();
	});

	it("rejects null", () => {
		expect(() => assertObject(null)).toThrow("Expected an object.");
	});

	it("throws the given message", () => {
		expect(() => assertObject(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
