import { describe, expect, expectTypeOf, it } from "vitest";

import { type EntriesMessage, isEntriesMessage } from "./entries-message";

describe("isEntriesMessage", () => {
	it("accepts an entries message", () => {
		const value: unknown = { type: "entries", entries: { language: {} } };

		expect(isEntriesMessage(value)).toBe(true);

		if (isEntriesMessage(value)) expectTypeOf(value).toEqualTypeOf<EntriesMessage>();
	});

	it.each([
		["a string", "hello"],
		["null", null],
		["another type", { type: "unknown", entries: {} }],
		["missing entries", { type: "entries" }],
		["null entries", { type: "entries", entries: null }],
		["array entries", { type: "entries", entries: [] }],
		["class instance entries", { type: "entries", entries: new Map() }],
	])("rejects %s", (_reason, value) => {
		expect(isEntriesMessage(value)).toBe(false);
	});
});
