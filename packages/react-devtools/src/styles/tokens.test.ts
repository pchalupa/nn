import { beforeAll, describe, expect, it } from "vitest";

import { getStyleSheet } from "./css";

const styles = (): string => Array.from(getStyleSheet().cssRules, (rule) => rule.cssText).join("\n");

describe("devtools tokens", () => {
	beforeAll(async () => {
		await import("../devtools");
	});

	it("names shared tokens as docs/design/tokens.css does", () => {
		expect(styles()).toContain("--gs-syntax-default: #faf0de");
		expect(styles()).toContain("--gs-syntax-number: #c7744a");
		expect(styles()).toContain("--gs-duration: 120ms");
		expect(styles()).not.toContain("--gs-syntax-text");
		expect(styles()).not.toContain("--gs-duration-fast");
	});

	it("colors numbers and bigints with the number token", () => {
		const rule = Array.from(getStyleSheet().cssRules, (candidate) => candidate.cssText).find((text) =>
			text.includes('[data-type="number"]'),
		);

		expect(rule).toContain('[data-type="bigint"]');
		expect(rule).not.toContain('[data-type="boolean"]');
		expect(rule).toContain("var(--gs-syntax-number)");
	});
});
