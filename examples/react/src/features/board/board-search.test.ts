import { describe, expect, it } from "vitest";

import { draftForBoardSearch, matchesBoardSearch, validateBoardSearch, withoutFilter } from "./board-search";

describe("validateBoardSearch", () => {
	it("keeps the assignee and label filters", () => {
		expect(validateBoardSearch({ assignee: "me", label: "bug", x: 1 })).toStrictEqual({ assignee: "me", label: "bug" });
	});

	it("drops an unknown assignee and an empty label", () => {
		expect(validateBoardSearch({ assignee: "you", label: "" })).toStrictEqual({});
	});
});

describe("matchesBoardSearch", () => {
	const ticket = { assignee: "ann", labels: ["bug"] };

	it("matches every ticket without filters", () => {
		expect(matchesBoardSearch(ticket, {}, undefined)).toBe(true);
	});

	it("keeps tickets assigned to the current user", () => {
		expect(matchesBoardSearch(ticket, { assignee: "me" }, "ann")).toBe(true);
		expect(matchesBoardSearch(ticket, { assignee: "me" }, "bob")).toBe(false);
		expect(matchesBoardSearch({ assignee: "", labels: [] }, { assignee: "me" }, undefined)).toBe(false);
	});

	it("keeps tickets with the label", () => {
		expect(matchesBoardSearch(ticket, { label: "bug" }, undefined)).toBe(true);
		expect(matchesBoardSearch(ticket, { label: "docs" }, undefined)).toBe(false);
	});
});

describe("draftForBoardSearch", () => {
	it("seeds nothing without filters", () => {
		expect(draftForBoardSearch({}, "ann")).toStrictEqual({});
	});

	it("assigns the current user and adds the filtered label", () => {
		expect(draftForBoardSearch({ assignee: "me", label: "bug" }, "ann")).toStrictEqual({
			assignee: "ann",
			labels: ["bug"],
		});
	});

	it("leaves the assignee empty without a signed-in user", () => {
		expect(draftForBoardSearch({ assignee: "me" }, undefined)).toStrictEqual({});
	});
});

describe("withoutFilter", () => {
	it("drops one filter and keeps the other", () => {
		expect(withoutFilter({ assignee: "me", label: "bug" }, "assignee")).toStrictEqual({ label: "bug" });
		expect(withoutFilter({ assignee: "me", label: "bug" }, "label")).toStrictEqual({ assignee: "me" });
	});
});
