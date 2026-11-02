import { describe, expect, it } from "vitest";

import { assertObject } from "./assertObject";

describe("assertObject", () => {
	it.each([{}, [], new Map()])("accepts %o", (value) => {
		expect(() => assertObject(value)).not.toThrow();
	});

	it.each([null, undefined, "a", () => undefined])("rejects %o", (value) => {
		expect(() => assertObject(value)).toThrow("Expected an object.");
	});
});
