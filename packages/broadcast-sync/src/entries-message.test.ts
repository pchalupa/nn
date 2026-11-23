import { describe, expect, it } from "vitest";

import { isEntriesMessage } from "./entries-message";

describe("isEntriesMessage", () => {
	it("accepts an entries message", () => {
		const value: unknown = { type: "entries", entries: { language: {} } };

		expect(isEntriesMessage(value)).toBe(true);
	});

	it.each([
		["a string", "hello"],
		["null", null],
		["another type", { type: "unknown", entries: {} }],
		["missing entries", { type: "entries" }],
		["null entries", { type: "entries", entries: null }],
	])("rejects %s", (_reason, value) => {
		expect(isEntriesMessage(value)).toBe(false);
	});
});
