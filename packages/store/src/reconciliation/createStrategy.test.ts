import type { Entity } from "@nn/entities/Entity";
import { LWWMap } from "@nn/entities/kinds/LWWMap";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { array, boolean, enumeration, number, object, type Schema, string } from "@nn/schema";
import { describe, expect, it } from "vitest";

import { createReconciliationStrategy } from "./createStrategy";
import { ListStrategy } from "./ListStrategy";
import { MapStrategy } from "./MapStrategy";
import { RegisterStrategy } from "./RegisterStrategy";

describe("createReconciliationStrategy", () => {
	it("creates a map strategy for an object schema", () => {
		const strategy = createReconciliationStrategy(object({ title: string() }), new WeakMap());

		expect(strategy).toBeInstanceOf(MapStrategy);
		expect(strategy.create(undefined, "root")).toBeInstanceOf(LWWMap);
	});

	it("creates a list strategy for an array schema at the root", () => {
		const strategy = createReconciliationStrategy(array(string()), new WeakMap());
		const entity = strategy.create(["a", "b"], "tags");

		RGA.assert(entity);

		expect(strategy).toBeInstanceOf(ListStrategy);
		expect(entity.current.map((item) => item.current)).toStrictEqual(["a", "b"]);
	});

	it("creates a list of lists for a nested array schema", () => {
		const entity = createReconciliationStrategy(array(array(number())), new WeakMap()).create([[1, 2], [3]], "grid");

		RGA.assert(entity);

		expect(
			entity.current.map((row) => {
				RGA.assert(row);

				return row.current.map((item) => item.current);
			}),
		).toStrictEqual([[1, 2], [3]]);
	});

	it("matches primitive list items by index", () => {
		const strategy = createReconciliationStrategy(array(string()), new WeakMap());
		const entity = strategy.create(["a"], "tags");

		RGA.assert(entity);

		const [first] = entity.current;

		strategy.reconcile(entity, ["b"]);

		expect(entity.current[0]).toBe(first);
		expect(entity.current[0]?.current).toBe("b");
	});

	it("matches object list items by identity", () => {
		const entities = new WeakMap<object, Entity>();
		const strategy = createReconciliationStrategy(array(object({ title: string() })), entities);
		const entity = strategy.create([{ title: "A" }, { title: "B" }], "rows");

		RGA.assert(entity);

		const [first, second] = entity.current;

		if (first === undefined || second === undefined) throw new Error("Expected two rows.");

		const draft = { title: "B" };

		entities.set(draft, second);
		strategy.reconcile(entity, [draft]);

		expect(entity.current).toStrictEqual([second]);
		expect(entity.find(first.key)).toBeUndefined();
	});

	it.each([
		["string", string(), ""],
		["number", number(), 0],
		["boolean", boolean(), false],
		["enumeration", enumeration("todo", "done"), "todo"],
	])("creates a register strategy with a default for a %s schema", (_name, schema, value) => {
		const strategy = createReconciliationStrategy(schema, new WeakMap());
		const entity = strategy.create(undefined, "field");

		expect(strategy).toBeInstanceOf(RegisterStrategy);
		expect(entity).toBeInstanceOf(LWWRegister);
		expect(entity.current).toBe(value);
	});

	it("throws a type error for an unsupported schema", () => {
		// oxlint-disable-next-line typescript/consistent-type-assertions
		expect(() => createReconciliationStrategy({ type: "date" } as unknown as Schema, new WeakMap())).toThrow(
			new TypeError('Unsupported schema type "date".'),
		);
	});
});
