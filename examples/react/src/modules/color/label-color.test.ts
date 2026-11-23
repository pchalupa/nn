import { describe, expect, it } from "vitest";

import { colorFor, type LabelColor } from "./label-color";

const colors: LabelColor[] = ["violet", "blue", "green", "red", "amber", "orange", "cyan", "pink"];

describe("colorFor", () => {
	it("returns the same color for the same name", () => {
		expect(colorFor("bug")).toBe(colorFor("bug"));
	});

	it("never returns gray", () => {
		for (let index = 0; index < 50; index++) {
			expect(colors).toContain(colorFor(`label-${index}`));
		}
	});

	it("spreads names across colors", () => {
		const names = ["a", "b", "c", "d", "e", "f", "g", "h"];

		expect(new Set(names.map(colorFor)).size).toBeGreaterThanOrEqual(4);
	});
});
