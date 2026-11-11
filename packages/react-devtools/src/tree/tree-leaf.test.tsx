import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TreeLeaf } from "./tree-leaf";

describe("TreeLeaf", () => {
	it.each([
		[3, "3", "number"],
		[Number.NaN, "NaN", "number"],
		[Number.POSITIVE_INFINITY, "Infinity", "number"],
		[Number.NEGATIVE_INFINITY, "-Infinity", "number"],
		["en", '"en"', "string"],
		["", '""', "string"],
		['say "hi"\n', String.raw`"say \"hi\"\n"`, "string"],
		[true, "true", "boolean"],
		[false, "false", "boolean"],
		[null, "null", "null"],
		[undefined, "undefined", "undefined"],
	])("renders %o as %s tagged %s", (value, text, type) => {
		const { container } = render(<TreeLeaf label="field" value={value} level={1} />);
		const node = container.querySelector(".value");

		expect(node?.textContent).toBe(text);
		expect(node?.getAttribute("data-type")).toBe(type);
	});
});
