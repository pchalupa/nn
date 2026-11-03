import { describe, expect, it } from "vitest";

import { number } from ".";
import { StringSchema } from "./string-schema";

describe("StringSchema", () => {
	it("creates an instance of StringSchema", () => {
		const stringSchema = new StringSchema();

		expect(stringSchema).toBeInstanceOf(StringSchema);
	});

	it("entitles a string schema", () => {
		const title = "test";
		const stringSchema = new StringSchema().entitle(title);

		expect(stringSchema.title).toBe(title);
	});

	it("describes a string schema", () => {
		const description = "test";
		const stringSchema = new StringSchema().describe(description);

		expect(stringSchema.description).toBe(description);
	});

	it("guards string schema type", () => {
		const stringSchema = new StringSchema();

		expect(StringSchema.is(stringSchema)).toBeTruthy();
		expect(StringSchema.is(number())).toBeFalsy();
		expect(StringSchema.is({ type: "string" })).toBeFalsy();
		expect(StringSchema.is(undefined)).toBeFalsy();
		expect(StringSchema.is(null)).toBeFalsy();
	});
});
