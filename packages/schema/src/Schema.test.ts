import { describe, expect, it } from "vitest";

import { ArraySchema } from "./ArraySchema";
import { BooleanSchema } from "./BooleanSchema";
import { array, boolean, number, object, string } from "./index";
import { NumberSchema } from "./NumberSchema";
import { ObjectSchema } from "./ObjectSchema";
import { StringSchema } from "./StringSchema";

describe("Schema", () => {
	it("should create a schema for each JSON Schema type", () => {
		expect(string()).toBeInstanceOf(StringSchema);
		expect(number()).toBeInstanceOf(NumberSchema);
		expect(boolean()).toBeInstanceOf(BooleanSchema);
		expect(object({})).toBeInstanceOf(ObjectSchema);
		expect(array(string())).toBeInstanceOf(ArraySchema);
	});

	it("should name the type after the JSON Schema type", () => {
		expect(string().type).toBe("string");
		expect(number().type).toBe("number");
		expect(boolean().type).toBe("boolean");
		expect(object({}).type).toBe("object");
		expect(array(string()).type).toBe("array");
	});

	it("should distinguish primitives at runtime", () => {
		expect(string().type).not.toBe(number().type);
		expect(number().type).not.toBe(boolean().type);
	});

	it("should set the title", () => {
		const schema = string().entitle("email");

		expect(schema.title).toBe("email");
	});

	it("should set the description", () => {
		const schema = string().describe("An email address");

		expect(schema.description).toBe("An email address");
	});

	it("should chain annotations", () => {
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

	it("should omit annotations that were not set", () => {
		const schema = string();

		expect(schema.title).toBeUndefined();
		expect(schema.description).toBeUndefined();
	});

	it("should expose object properties", () => {
		const schema = object({ name: string(), age: number() });

		expect(schema.properties).toMatchInlineSnapshot(`
			{
			  "age": NumberSchema {
			    "type": "number",
			  },
			  "name": StringSchema {
			    "type": "string",
			  },
			}
		`);
	});

	it("should expose array items", () => {
		const item = object({ name: string() });
		const schema = array(item);

		expect(schema.items).toBe(item);
	});

	it("should describe a nested schema", () => {
		const user = object({ name: string().describe("User name") })
			.entitle("user")
			.describe("Holds information about a user.");

		expect(object({ users: array(user).describe("List of users") })).toMatchInlineSnapshot(`
			ObjectSchema {
			  "properties": {
			    "users": ArraySchema {
			      "description": "List of users",
			      "items": ObjectSchema {
			        "description": "Holds information about a user.",
			        "properties": {
			          "name": StringSchema {
			            "description": "User name",
			            "type": "string",
			          },
			        },
			        "title": "user",
			        "type": "object",
			      },
			      "type": "array",
			    },
			  },
			  "type": "object",
			}
		`);
	});
});
