import { describe, expect, it } from "vitest";

import { string } from ".";
import { NumberSchema } from "./NumberSchema";

describe("NumberSchema", () => {
	it("should create an instance of NumberSchema", () => {
		const numberSchema = new NumberSchema();

		expect(numberSchema).toBeInstanceOf(NumberSchema);
	});

	it("should entitle a number schema", () => {
		const title = "test";
		const numberSchema = new NumberSchema().entitle(title);

		expect(numberSchema.title).toBe(title);
	});

	it("should describe a number schema", () => {
		const description = "test";
		const numberSchema = new NumberSchema().describe(description);

		expect(numberSchema.description).toBe(description);
	});

	it("should guard number schema type", () => {
		const numberSchema = new NumberSchema();

		expect(NumberSchema.isNumberSchema(numberSchema)).toBeTruthy();
		expect(NumberSchema.isNumberSchema(string())).toBeFalsy();
		expect(NumberSchema.isNumberSchema({ type: "number" })).toBeFalsy();
		expect(NumberSchema.isNumberSchema(undefined)).toBeFalsy();
		expect(NumberSchema.isNumberSchema(null)).toBeFalsy();
	});
});
