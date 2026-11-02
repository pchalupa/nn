import { describe, expect, it } from "vitest";

import { string } from ".";
import { BooleanSchema } from "./BooleanSchema";

describe("BooleanSchema", () => {
	it("creates an instance of BooleanSchema", () => {
		const booleanSchema = new BooleanSchema();

		expect(booleanSchema).toBeInstanceOf(BooleanSchema);
	});

	it("entitles a boolean schema", () => {
		const title = "test";
		const booleanSchema = new BooleanSchema().entitle(title);

		expect(booleanSchema.title).toBe(title);
	});

	it("describes a boolean schema", () => {
		const description = "test";
		const booleanSchema = new BooleanSchema().describe(description);

		expect(booleanSchema.description).toBe(description);
	});

	it("guards boolean schema type", () => {
		const booleanSchema = new BooleanSchema();

		expect(BooleanSchema.is(booleanSchema)).toBeTruthy();
		expect(BooleanSchema.is(string())).toBeFalsy();
		expect(BooleanSchema.is({ type: "boolean" })).toBeFalsy();
		expect(BooleanSchema.is(undefined)).toBeFalsy();
		expect(BooleanSchema.is(null)).toBeFalsy();
	});
});
