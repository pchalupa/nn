import { describe, expect, it } from "vitest";

describe("css", () => {
	it("collects rules registered before and after the sheet exists", async () => {
		const { css, getStyleSheet } = await import("./css");

		css`
			.early {
				color: red;
			}
		`;

		const sheet = getStyleSheet();

		css`
			.late {
				color: blue;
			}
		`;

		expect(sheet).toBeInstanceOf(CSSStyleSheet);
		expect(sheet.cssRules).toHaveLength(2);
	});
});
