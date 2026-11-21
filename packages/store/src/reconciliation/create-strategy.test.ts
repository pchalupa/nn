import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { array, boolean, enumeration, number, object, string } from "@nn/schema";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createReconciliationStrategy } from "./create-strategy";
import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { ReconcileContext } from "./strategy";

function contextOf(entities: WeakMap<object, Entity> = new WeakMap()): ReconcileContext {
	return {
		inspect: () => undefined,
		fill: () => undefined,
		identify: (value) => entities.get(value),
		resolve: (item) => item,
	};
}

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

	it("creates a list of lists for a nested array schema", () => {
		const entity = createReconciliationStrategy(array(array(number()))).create([[1, 2], [3]], "grid");

		RGA.assert(entity);

		expect(
			entity.current.map((list) => {
				RGA.assert(list);

				return list.current.map((item) => item.current);
			}),
		).toStrictEqual([[1, 2], [3]]);
	});

	it("matches primitive list items by index", () => {
		const strategy = createReconciliationStrategy(array(string()));
		const entity = strategy.create(["a"], "tags");

		RGA.assert(entity);

		const [first] = entity.current;

		strategy.reconcile(entity, ["b"], contextOf());

		expect(entity.current[0]).toBe(first);
		expect(entity.current[0]?.current).toBe("b");
	});

	it("matches object list items by identity", () => {
		const entities = new WeakMap<object, Entity>();
		const strategy = createReconciliationStrategy(array(object({ title: string() })));
		const entity = strategy.create([{ title: "A" }, { title: "B" }], "items");

		RGA.assert(entity);

		const [first, second] = entity.current;

		if (first === undefined || second === undefined) throw new Error("Expected two items.");

		const draft = { title: "B" };

		entities.set(draft, second);
		strategy.reconcile(entity, [draft], contextOf(entities));

		expect(entity.current).toStrictEqual([second]);
		expect(entity.get(first.key)).toBeUndefined();
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

	it("types the strategy for an object schema as a map strategy", () => {
		expectTypeOf(createReconciliationStrategy(object({ title: string() }))).toEqualTypeOf<MapStrategy>();
	});

	it("types the strategy for an array schema as a list strategy", () => {
		expectTypeOf(createReconciliationStrategy(array(object({ title: string() })))).toEqualTypeOf<ListStrategy>();
	});

	it("types the strategy for a primitive schema as a register strategy", () => {
		expectTypeOf(createReconciliationStrategy(string())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(number())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(boolean())).toEqualTypeOf<RegisterStrategy>();
		expectTypeOf(createReconciliationStrategy(enumeration("todo", "done"))).toEqualTypeOf<RegisterStrategy>();
	});
});
