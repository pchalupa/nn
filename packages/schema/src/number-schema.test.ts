import { describe, expect, it } from "vitest";

import { string } from ".";
import { NumberSchema } from "./number-schema";

describe("NumberSchema", () => {
	it("creates an instance of NumberSchema", () => {
		const numberSchema = new NumberSchema();

		expect(numberSchema).toBeInstanceOf(NumberSchema);
	});

	it("entitles a number schema", () => {
		const title = "test";
		const numberSchema = new NumberSchema().entitle(title);

		expect(numberSchema.title).toBe(title);
	});

	it("describes a number schema", () => {
		const description = "test";
		const numberSchema = new NumberSchema().describe(description);

		expect(numberSchema.description).toBe(description);
	});

	it("guards number schema type", () => {
		const numberSchema = new NumberSchema();

		expect(NumberSchema.is(numberSchema)).toBeTruthy();
		expect(NumberSchema.is(string())).toBeFalsy();
		expect(NumberSchema.is({ type: "number" })).toBeFalsy();
		expect(NumberSchema.is(undefined)).toBeFalsy();
		expect(NumberSchema.is(null)).toBeFalsy();
	});
});
