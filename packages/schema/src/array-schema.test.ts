import { describe, expect, it } from "vitest";

import { string } from ".";
import { ArraySchema } from "./array-schema";

describe("ArraySchema", () => {
	it("exposes its items", () => {
		const items = string();
		const arraySchema = new ArraySchema(items);

		expect(arraySchema.items).toBe(items);
	});
});
