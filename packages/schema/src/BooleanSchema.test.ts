import { describe, expect, it } from "vitest";

import { string } from ".";
import { BooleanSchema } from "./BooleanSchema";

describe("BooleanSchema", () => {
	it("should create an instance of BooleanSchema", () => {
		const booleanSchema = new BooleanSchema();

		expect(booleanSchema).toBeInstanceOf(BooleanSchema);
	});

	it("should entitle a boolean schema", () => {
		const title = "test";
		const booleanSchema = new BooleanSchema().entitle(title);

		expect(booleanSchema.title).toBe(title);
	});

	it("should describe a boolean schema", () => {
		const description = "test";
		const booleanSchema = new BooleanSchema().describe(description);

		expect(booleanSchema.description).toBe(description);
	});

	it("should guard boolean schema type", () => {
		const booleanSchema = new BooleanSchema();

		expect(BooleanSchema.isBooleanSchema(booleanSchema)).toBeTruthy();
		expect(BooleanSchema.isBooleanSchema(string())).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema({ type: "boolean" })).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema(undefined)).toBeFalsy();
		expect(BooleanSchema.isBooleanSchema(null)).toBeFalsy();
	});
});
