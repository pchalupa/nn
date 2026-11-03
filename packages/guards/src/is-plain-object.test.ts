import { describe, expect, it } from "vitest";

import { isPlainObject } from "./is-plain-object";

describe("isPlainObject", () => {
	it.each([{}, { a: 1 }, Object.create(null)])("accepts %o", (value) => {
		expect(isPlainObject(value)).toBe(true);
	});

	it.each([[], new Map(), new Date(), null, undefined, "a", () => undefined])("rejects %o", (value) => {
		expect(isPlainObject(value)).toBe(false);
	});
});
