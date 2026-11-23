import { describe, expect, expectTypeOf, it } from "vitest";

import { enumeration } from ".";
import type { InferStateType } from "./schema";

describe("EnumerationSchema", () => {
	it("exposes its literals", () => {
		const enumerationSchema = enumeration("todo", "in-progress", "done");

		expect(enumerationSchema.literals).toStrictEqual(["todo", "in-progress", "done"]);
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
