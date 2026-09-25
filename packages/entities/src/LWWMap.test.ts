import { describe, expect, it, vi } from "vitest";

import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";

describe("LWWMap", () => {
	it("should create a map with initial value", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), age: new LWWRegister(30) });

		expect(map.current.name.current).toBe("John");
		expect(map).toBeInstanceOf(LWWMap);
	});

	it("should serialize map", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), address: new LWWMap({ city: new LWWRegister("Prague") }) });

		expect(JSON.stringify(map)).toMatchInlineSnapshot(`"{"name":"John","address":{"city":"Prague"}}"`);
	});

	it("should update property value and reflect changes", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });

		expect(map.current.name.current).toBe("Alice");
		expect(map.current.age.current).toBe(25);

		map.current.name.current = "Bob";
		map.current.age.current = 40;

		expect(map.current.name.current).toBe("Bob");
		expect(map.current.age.current).toBe(40);
	});

	it("should write values through set", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), age: new LWWRegister(30) });

		map.set((current) => ({ ...current, name: new LWWRegister("Jane") }));
		map.current.name.current = "Jane";

		expect(map.current.name.current).toBe("Jane");
		expect(map.current.age.current).toBe(30);
	});

	it("should merge maps with multiple properties", () => {
		const mapA = new LWWMap({ name: new LWWRegister("foo"), age: new LWWRegister(20) });
		const mapB = new LWWMap({ name: new LWWRegister("bar"), age: new LWWRegister(30) });

		const result = mapA.merge(mapB);

		expect(result.current.name.current).toBe("bar");
		expect(result.current.age.current).toBe(30);
	});

	it("exclude remote‐only keys when merging", () => {
		const a = new LWWMap({ foo: new LWWRegister("a") });
		const b = new LWWMap({ foo: new LWWRegister("b"), bar: new LWWRegister(1) });

		const result = a.merge(b);

		expect(result.current.foo.current).toBe("b");
		expect("bar" in result.current).toBeFalsy();
	});

	it("should emit update event when property changes", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback = vi.fn();

		map.subscribe(callback);

		expect(callback).toHaveBeenCalledTimes(0);

		map.current.name.current = "Bob";

		expect(callback).toHaveBeenCalledTimes(1);

		map.current.age.current = 30;

		expect(callback).toHaveBeenCalledTimes(2);
	});

	it("should return unsubscribe function", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback = vi.fn();

		const unsubscribe = map.subscribe(callback);

		unsubscribe();

		map.current.age.current = 30;

		expect(callback).not.toHaveBeenCalled();
	});

	it("should support multiple subscribers", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback1 = vi.fn();
		const callback2 = vi.fn();

		map.subscribe(callback1);
		map.subscribe(callback2);

		map.current.age.current = 30;

		expect(callback1).toHaveBeenCalledTimes(1);
		expect(callback2).toHaveBeenCalledTimes(1);
	});
});
