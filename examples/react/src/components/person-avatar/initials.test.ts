import { describe, expect, it } from "vitest";

import { initials } from "./initials";

describe("initials", () => {
	it.each([
		["Petr Chalupa", "PC"],
		["triage-bot", "T"],
		["  anna  ", "A"],
		["", "?"],
		["Jan Maria Novak", "JN"],
	])("turns %j into %j", (name, expected) => {
		expect(initials(name)).toBe(expected);
	});
});
