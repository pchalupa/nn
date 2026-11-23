import { describe, expect, it } from "vitest";

import { string } from ".";
import { ObjectSchema } from "./object-schema";

describe("ObjectSchema", () => {
	it("exposes its properties", () => {
		const name = string();
		const objectSchema = new ObjectSchema({ name });

		expect(objectSchema.properties.name).toBe(name);
	});
});
