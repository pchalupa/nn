import { describe, expect, it } from "vitest";

import { assertObject } from "./assert-object";

describe("assertObject", () => {
	it.each([{}, [], new Map()])("accepts %o", (value) => {
		expect(() => assertObject(value)).not.toThrow();
	});

	it.each([null, undefined, "a", () => undefined])("rejects %o", (value) => {
		expect(() => assertObject(value)).toThrow("Expected an object.");
	});

	it("throws the given message", () => {
		expect(() => assertObject(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
