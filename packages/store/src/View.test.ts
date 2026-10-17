import { describe, expect, it } from "vitest";

import { StoreError } from "./errors/StoreError";
import { clone, isPlainObject, snapshot } from "./View";

describe("snapshot", () => {
	it("preserves primitives", () => {
		for (const value of [undefined, null, "a", 1, NaN, -0]) {
			expect(snapshot(value)).toBe(value);
		}
	});

	it("copies and freezes without freezing the source", () => {
		const source = { items: [{ title: "First" }] };
		const result = snapshot(source);
		if (!isPlainObject(result) || !Array.isArray(result.items)) throw new Error("Expected items");
		expect(result).not.toBe(source);
		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.items)).toBe(true);
		expect(Object.isFrozen(result.items[0])).toBe(true);
		expect(Object.isFrozen(source)).toBe(false);
		expect(Object.isFrozen(source.items)).toBe(false);
		expect(Object.isFrozen(source.items[0])).toBe(false);
		source.items[0].title = "Changed";
		source.items.push({ title: "Second" });
		expect(result).toStrictEqual({ items: [{ title: "First" }] });
	});

	it("preserves array holes and distinguishes undefined", () => {
		const sparse: unknown[] = ["x"];
		delete sparse[0];
		const result = snapshot(sparse);
		if (!Array.isArray(result)) throw new Error("Expected an array");
		expect(result).toStrictEqual(sparse);
		expect(result).toHaveLength(1);
		expect(Object.hasOwn(result, 0)).toBe(false);
		const full = snapshot([undefined]);
		if (!Array.isArray(full)) throw new Error("Expected an array");
		expect(Object.hasOwn(full, 0)).toBe(true);
	});

	it("preserves own object properties", () => {
		expect(snapshot({ title: undefined })).toStrictEqual({ title: undefined });
		const special = Object.fromEntries([
			["__proto__", "value"],
			["toString", "own"],
		]);
		const result = snapshot(special);
		if (!isPlainObject(result)) throw new Error("Expected a record");
		expect(Object.hasOwn(result, "__proto__")).toBe(true);
		expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
		expect(result.__proto__).toBe("value");
	});

	it("rejects values that cannot be cloned", () => {
		expect(() => snapshot(() => null)).toThrow(StoreError);
		expect(() => clone({ callback: () => null })).toThrow(StoreError);
	});

	it("freezes shared and cyclic plain data", () => {
		const source: Record<string, unknown> = { nested: { title: "First" } };
		source.self = source;
		source.other = source.nested;
		const result = snapshot(source);
		if (!isPlainObject(result)) throw new Error("Expected a record");
		expect(result.self).toBe(result);
		expect(result.other).toBe(result.nested);
		expect(Object.isFrozen(result.nested)).toBe(true);
		expect(Object.isFrozen(source.nested)).toBe(false);
	});
});

describe("clone", () => {
	it("makes a writable detached copy of a snapshot", () => {
		const source = snapshot({ nested: { title: "First" } });
		const result = clone(source);
		if (!isPlainObject(result) || !isPlainObject(result.nested)) throw new Error("Expected nested data");
		expect(Object.isFrozen(result)).toBe(false);
		expect(Object.isFrozen(result.nested)).toBe(false);
		result.nested.title = "Changed";
		expect(source).toStrictEqual({ nested: { title: "First" } });
	});
});
