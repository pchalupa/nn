import { describe, expect, it } from "vitest";

import { addLabel, withoutLabel } from "./labels";

describe("addLabel", () => {
	it("appends a missing label in place", () => {
		const labels = ["docs"];

		addLabel(labels, "bug");

		expect(labels).toStrictEqual(["docs", "bug"]);
	});

	it("does not add a label twice", () => {
		const labels = ["bug"];

		addLabel(labels, "bug");

		expect(labels).toStrictEqual(["bug"]);
	});
});

describe("withoutLabel", () => {
	it("removes every copy of the label", () => {
		expect(withoutLabel(["bug", "docs", "bug"], "bug")).toStrictEqual(["docs"]);
	});
});
