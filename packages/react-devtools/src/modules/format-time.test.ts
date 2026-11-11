import { describe, expect, it } from "vitest";

import { formatTime } from "./format-time";

describe("formatTime", () => {
	it("prints the local date followed by a 24-hour clock with milliseconds", () => {
		const date = new Date(2024, 10, 10, 21, 5, 7, 42);
		const formatted = formatTime(date.getTime());

		expect(formatted.startsWith(`${date.toLocaleDateString()}`)).toBe(true);
		expect(formatted).toMatch(/21\D05\D07\D042$/);
	});

	it("pads single-digit hours", () => {
		expect(formatTime(new Date(2024, 0, 1, 9, 0, 0, 5).getTime())).toMatch(/09\D00\D00\D005$/);
	});
});
