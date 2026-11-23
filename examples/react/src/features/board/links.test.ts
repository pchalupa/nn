import { describe, expect, it } from "vitest";

import { describeLink, parseLinkInput } from "./links";

const repo = "https://github.com/pchalupa/nn";

describe("describeLink", () => {
	it("describes a pull request by its number", () => {
		expect(describeLink(`${repo}/pull/212`)).toStrictEqual({ kind: "pull-request", title: "PR #212", meta: "#212" });
	});

	it("describes a commit by its short hash", () => {
		expect(describeLink(`${repo}/commit/a3f9c21d0e`)).toStrictEqual({
			kind: "commit",
			title: "Commit a3f9c21",
			meta: "a3f9c21",
		});
	});

	it("describes any other page as a document named after its file", () => {
		expect(
			describeLink(`${repo}/blob/main/docs/decisions/ADR-16-give-sync-engines-a-connection-lifecycle.md`),
		).toStrictEqual({
			kind: "document",
			title: "ADR-16-give-sync-engines-a-connection-lifecycle.md",
			meta: "github.com",
		});
	});
});

describe("parseLinkInput", () => {
	it("keeps a trimmed web URL", () => {
		expect(parseLinkInput("  https://example.com/x  ")).toBe("https://example.com/x");
	});

	it("rejects a PR number or a commit hash", () => {
		expect(parseLinkInput("#212")).toBeUndefined();
		expect(parseLinkInput("212")).toBeUndefined();
		expect(parseLinkInput("a3f9c21")).toBeUndefined();
	});

	it("rejects text that is not a link", () => {
		expect(parseLinkInput("not a link")).toBeUndefined();
	});

	it("rejects URLs that are not http or https", () => {
		expect(parseLinkInput("javascript:alert(1)")).toBeUndefined();
	});
});
