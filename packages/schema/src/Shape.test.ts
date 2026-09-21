import { describe, expect, it } from "vitest";
import { array, boolean, number, object, string } from "./index";
import { ArrayShape, BooleanShape, NumberShape, ObjectShape, StringShape } from "./Shape";

describe("Shape", () => {
	it("should create a shape for each JSON Schema type", () => {
		expect(string()).toBeInstanceOf(StringShape);
		expect(number()).toBeInstanceOf(NumberShape);
		expect(boolean()).toBeInstanceOf(BooleanShape);
		expect(object({})).toBeInstanceOf(ObjectShape);
		expect(array(string())).toBeInstanceOf(ArrayShape);
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
		const shape = string().entitle("email");

		expect(shape.title).toBe("email");
	});

	it("should set the description", () => {
		const shape = string().describe("An email address");

		expect(shape.description).toBe("An email address");
	});

	it("should chain annotations", () => {
		const shape = string().entitle("email").describe("An email address");

		expect(shape).toBeInstanceOf(StringShape);
		expect(shape).toMatchInlineSnapshot(`
			StringShape {
			  "description": "An email address",
			  "title": "email",
			  "type": "string",
			}
		`);
	});

	it("should omit annotations that were not set", () => {
		const shape = string();

		expect(shape.title).toBeUndefined();
		expect(shape.description).toBeUndefined();
	});

	it("should expose object properties", () => {
		const shape = object({ name: string(), age: number() });

		expect(shape.properties).toMatchInlineSnapshot(`
			{
			  "age": NumberShape {
			    "type": "number",
			  },
			  "name": StringShape {
			    "type": "string",
			  },
			}
		`);
	});

	it("should expose array items", () => {
		const item = object({ name: string() });
		const shape = array(item);

		expect(shape.items).toBe(item);
	});

	it("should describe a nested schema", () => {
		const user = object({ name: string().describe("User name") })
			.entitle("user")
			.describe("Holds information about a user.");

		expect(object({ users: array(user).describe("List of users") })).toMatchInlineSnapshot(`
			ObjectShape {
			  "properties": {
			    "users": ArrayShape {
			      "description": "List of users",
			      "items": ObjectShape {
			        "description": "Holds information about a user.",
			        "properties": {
			          "name": StringShape {
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
