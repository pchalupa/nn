import { describe, expect, expectTypeOf, it } from "vitest";

import { ArraySchema } from "./array-schema";
import { BooleanSchema } from "./boolean-schema";
import { EnumerationSchema } from "./enumeration-schema";
import { array, boolean, enumeration, number, object, string } from "./index";
import { NumberSchema } from "./number-schema";
import { ObjectSchema } from "./object-schema";
import { type InferStateType, Schema } from "./schema";
import { StringSchema } from "./string-schema";

describe("Schema", () => {
	it("creates a schema for each JSON Schema type", () => {
		expect(string()).toBeInstanceOf(StringSchema);
		expect(number()).toBeInstanceOf(NumberSchema);
		expect(boolean()).toBeInstanceOf(BooleanSchema);
		expect(enumeration("todo")).toBeInstanceOf(EnumerationSchema);
		expect(object({})).toBeInstanceOf(ObjectSchema);
		expect(array(string())).toBeInstanceOf(ArraySchema);
	});

	it("names the type after the JSON Schema type", () => {
		expect(string().type).toBe("string");
		expect(number().type).toBe("number");
		expect(boolean().type).toBe("boolean");
		expect(enumeration("todo").type).toBe("enumeration");
		expect(object({}).type).toBe("object");
		expect(array(string()).type).toBe("array");
	});

	it("chains annotations", () => {
		const schema = string().entitle("email").describe("An email address");

		expect(schema).toBeInstanceOf(StringSchema);
		expect(schema).toMatchInlineSnapshot(`
			StringSchema {
			  "description": "An email address",
			  "title": "email",
			  "type": "string",
			}
		`);
	});

	it("omits annotations that were not set", () => {
		const schema = string();

		expect(schema.title).toBeUndefined();
		expect(schema.description).toBeUndefined();
	});

	it.each([
		{ name: "Schema", guard: Schema.is, schema: array(object({})), others: [{ type: "array" }] },
		{ name: "StringSchema", guard: StringSchema.is, schema: string(), others: [number(), { type: "string" }] },
		{ name: "NumberSchema", guard: NumberSchema.is, schema: number(), others: [string(), { type: "number" }] },
		{ name: "BooleanSchema", guard: BooleanSchema.is, schema: boolean(), others: [string(), { type: "boolean" }] },
		{
			name: "EnumerationSchema",
			guard: EnumerationSchema.is,
			schema: enumeration("todo"),
			others: [string(), { type: "enumeration", literals: ["todo"] }],
		},
		{
			name: "ObjectSchema",
			guard: ObjectSchema.is,
			schema: object({}),
			others: [array(string()), { properties: {}, type: "object" }],
		},
		{
			name: "ArraySchema",
			guard: ArraySchema.is,
			schema: array(string()),
			others: [object({}), { items: string(), type: "array" }],
		},
	])("guards the $name type", ({ guard, schema, others }) => {
		expect(guard(schema)).toBe(true);

		for (const other of [...others, undefined, null]) {
			expect(guard(other)).toBe(false);
		}
	});

	it("infers the declared data type", () => {
		expectTypeOf<InferStateType<StringSchema>>().toEqualTypeOf<string>();
		expectTypeOf<InferStateType<NumberSchema>>().toEqualTypeOf<number>();
		expectTypeOf<InferStateType<BooleanSchema>>().toEqualTypeOf<boolean>();
	});

	it("infers nested objects and arrays", () => {
		const schema = object({
			tickets: array(object({ title: string(), assignee: object({ name: string() }) })),
			language: string(),
		});

		expectTypeOf<InferStateType<typeof schema>>().toEqualTypeOf<{
			tickets: Array<{ title: string; assignee: { name: string } }>;
			language: string;
		}>();
	});
});
