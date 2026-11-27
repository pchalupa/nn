import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";
import { RGA } from "@goodstate/entities/kinds/rga";
import { array, boolean, enumeration, number, object, string } from "@goodstate/schema";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createReconciliationStrategy } from "./create-strategy";
import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";

describe("createReconciliationStrategy", () => {
	it("creates a map strategy for an object schema", () => {
		const strategy = createReconciliationStrategy(object({ title: string() }));

		expect(strategy).toBeInstanceOf(MapStrategy);
		expect(strategy.create(undefined, "root")).toBeInstanceOf(LWWMap);
	});

	it("creates a list strategy for an array schema at the root", () => {
		const strategy = createReconciliationStrategy(array(string()));
		const entity = strategy.create(["a", "b"], "tags");

		RGA.assert(entity);

		expect(strategy).toBeInstanceOf(ListStrategy);
		expect(entity.current.map((item) => item.current)).toStrictEqual(["a", "b"]);
	});

	it.each([
		["string", string(), ""],
		["number", number(), 0],
		["boolean", boolean(), false],
		["enumeration", enumeration("todo", "done"), "todo"],
	])("creates a register strategy with a default for a %s schema", (_name, schema, value) => {
		const strategy = createReconciliationStrategy(schema);
		const entity = strategy.create(undefined, "field");

		expect(strategy).toBeInstanceOf(RegisterStrategy);
		expect(entity).toBeInstanceOf(LWWRegister);
		expect(entity.current).toBe(value);
	});

	it("throws a type error for an unsupported schema", () => {
		const schema = string();

		Object.setPrototypeOf(schema, Object.prototype);
		Reflect.set(schema, "type", "date");

		expect(() => createReconciliationStrategy(schema)).toThrow(new TypeError('Unsupported schema type "date".'));
	});

	it("types the strategy by the schema kind", () => {
		expectTypeOf(createReconciliationStrategy(object({ title: string() }))).toEqualTypeOf<MapStrategy>();
		expectTypeOf(createReconciliationStrategy(array(object({ title: string() })))).toEqualTypeOf<ListStrategy>();
		expectTypeOf(createReconciliationStrategy(string())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(number())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(boolean())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(enumeration("todo", "done"))).toEqualTypeOf<RegisterStrategy>();
	});
});
