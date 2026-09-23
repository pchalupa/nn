import { describe, expect, it } from "vitest";

import { object, string } from ".";
import { ArraySchema } from "./ArraySchema";

describe("ArraySchema", () => {
	it("should create an instance of ArraySchema", () => {
		const arraySchema = new ArraySchema(string());

		expect(arraySchema).toBeInstanceOf(ArraySchema);
	});

	it("should expose its items", () => {
		const items = string();
		const arraySchema = new ArraySchema(items);

		expect(arraySchema.items).toBe(items);
	});

	it("should entitle an array schema", () => {
		const title = "test";
		const arraySchema = new ArraySchema(string()).entitle(title);

		expect(arraySchema.title).toBe(title);
	});

	it("should describe an array schema", () => {
		const description = "test";
		const arraySchema = new ArraySchema(string()).describe(description);

		expect(arraySchema.description).toBe(description);
	});

	it("should guard array schema type", () => {
		const arraySchema = new ArraySchema(string());

		expect(ArraySchema.isArraySchema(arraySchema)).toBeTruthy();
		expect(ArraySchema.isArraySchema(object({}))).toBeFalsy();
		expect(ArraySchema.isArraySchema({ items: string(), type: "array" })).toBeFalsy();
		expect(ArraySchema.isArraySchema(undefined)).toBeFalsy();
		expect(ArraySchema.isArraySchema(null)).toBeFalsy();
	});
});
