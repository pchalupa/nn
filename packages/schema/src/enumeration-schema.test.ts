import { describe, expect, expectTypeOf, it } from "vitest";

import { enumeration, string } from ".";
import { EnumerationSchema } from "./enumeration-schema";
import type { InferStateType } from "./schema";

describe("EnumerationSchema", () => {
	it("creates an instance of EnumerationSchema", () => {
		const enumerationSchema = enumeration("todo", "done");

		expect(enumerationSchema).toBeInstanceOf(EnumerationSchema);
		expect(enumerationSchema.type).toBe("enumeration");
	});

	it("exposes its literals", () => {
		const enumerationSchema = enumeration("todo", "in-progress", "done");

		expect(enumerationSchema.literals).toStrictEqual(["todo", "in-progress", "done"]);
	});

	it("entitles an enumeration schema", () => {
		const title = "test";
		const enumerationSchema = enumeration("todo").entitle(title);

		expect(enumerationSchema.title).toBe(title);
	});

	it("describes an enumeration schema", () => {
		const description = "test";
		const enumerationSchema = enumeration("todo").describe(description);

		expect(enumerationSchema.description).toBe(description);
	});

	it("guards enumeration schema type", () => {
		const enumerationSchema = enumeration("todo");

		expect(EnumerationSchema.is(enumerationSchema)).toBeTruthy();
		expect(EnumerationSchema.is(string())).toBeFalsy();
		expect(EnumerationSchema.is({ type: "enumeration", literals: ["todo"] })).toBeFalsy();
		expect(EnumerationSchema.is(undefined)).toBeFalsy();
		expect(EnumerationSchema.is(null)).toBeFalsy();
	});

	it("infers a union of its literals", () => {
		const enumerationSchema = enumeration("todo", "in-progress", "done");

		expectTypeOf<InferStateType<typeof enumerationSchema>>().toEqualTypeOf<"todo" | "in-progress" | "done">();
	});

	it("requires at least one value", () => {
		expectTypeOf<[]>().not.toExtend<Parameters<typeof enumeration>[0]>();
		expectTypeOf<[number]>().not.toExtend<Parameters<typeof enumeration>[0]>();
	});
});
