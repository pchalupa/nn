import { describe, expect, it } from "vitest";

import { array, string } from ".";
import { ObjectSchema } from "./ObjectSchema";

describe("ObjectSchema", () => {
	it("creates an instance of ObjectSchema", () => {
		const objectSchema = new ObjectSchema({ name: string() });

		expect(objectSchema).toBeInstanceOf(ObjectSchema);
	});

	it("exposes its properties", () => {
		const name = string();
		const objectSchema = new ObjectSchema({ name });

		expect(objectSchema.properties.name).toBe(name);
	});

	it("entitles an object schema", () => {
		const title = "test";
		const objectSchema = new ObjectSchema({ name: string() }).entitle(title);

		expect(objectSchema.title).toBe(title);
	});

	it("describes an object schema", () => {
		const description = "test";
		const objectSchema = new ObjectSchema({ name: string() }).describe(description);

		expect(objectSchema.description).toBe(description);
	});

	it("guards object schema type", () => {
		const objectSchema = new ObjectSchema({ name: string() });

		expect(ObjectSchema.isObjectSchema(objectSchema)).toBeTruthy();
		expect(ObjectSchema.isObjectSchema(array(string()))).toBeFalsy();
		expect(ObjectSchema.isObjectSchema({ properties: {}, type: "object" })).toBeFalsy();
		expect(ObjectSchema.isObjectSchema(undefined)).toBeFalsy();
		expect(ObjectSchema.isObjectSchema(null)).toBeFalsy();
	});
});
