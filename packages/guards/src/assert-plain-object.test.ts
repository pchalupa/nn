import { describe, expect, it } from "vitest";

import { assertPlainObject } from "./assert-plain-object";

describe("assertPlainObject", () => {
	it.each([{}, { a: 1 }, Object.create(null)])("accepts %o", (value) => {
		expect(() => assertPlainObject(value)).not.toThrow();
	});

	it.each([[], new Map(), new Date(), null, undefined, "a", () => undefined])("rejects %o", (value) => {
		expect(() => assertPlainObject(value)).toThrow("Expected a plain object.");
	});

	it("throws the given message", () => {
		expect(() => assertPlainObject(undefined, "Custom message.")).toThrow("Custom message.");
	});
});
