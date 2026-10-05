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

		expect(BooleanSchema.isBooleanSchema(booleanSchema)).toBeTruthy();
		expect(BooleanSchema.isBooleanSchema(string())).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema({ type: "boolean" })).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema(undefined)).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema(null)).toBeFalsy();
	});
});
