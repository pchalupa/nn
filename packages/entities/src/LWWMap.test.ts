import { describe, expect, it, vi } from "vitest";
import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";

describe("LWWMap", () => {
	it("should create a map with initial value", () => {
		const map = new LWWMap({ name: new LWWRegister("John"), age: new LWWRegister(30) });

		expect(map.name).toBe("John");
		expect(map).toBeInstanceOf(LWWMap);
		expect(map.toString()).toBe("[object LWWMap]");
	});

	it("should update property value and reflect changes", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });

		expect(map.name).toBe("Alice");
		expect(map.age).toBe(25);

		map.name = "Bob";
		map.age = 40;

		expect(map.name).toBe("Bob");
		expect(map.age).toBe(40);
	});

	it("should merge maps with multiple properties", () => {
		const mapA = new LWWMap({ name: new LWWRegister("foo"), age: new LWWRegister(20) });
		const mapB = new LWWMap({ name: new LWWRegister("bar"), age: new LWWRegister(30) });

		const result = mapA.merge(mapB);

		expect(result.name).toBe("bar");
		expect(result.age).toBe(30);
	});

	it("exclude remote‐only keys when merging", () => {
		const a = new LWWMap({ foo: new LWWRegister("a") });
		const b = new LWWMap({ foo: new LWWRegister("b"), bar: new LWWRegister(1) });

		const result = a.merge(b);

		expect(result.foo).toBe("b");
		expect(result.bar).toBe(undefined);
	});

	it("should emit update event when property changes", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback = vi.fn();

		map.subscribe(callback);

		expect(callback).toBeCalledTimes(0);

		map.name = "Bob";

		expect(callback).toBeCalledTimes(1);

		map.age = 30;

		expect(callback).toBeCalledTimes(2);
	});

	it("should return unsubscribe function", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback = vi.fn();

		const unsubscribe = map.subscribe(callback);

		unsubscribe();

		map.age = 30;

		expect(callback).not.toHaveBeenCalled();
	});

	it("should support multiple subscribers", () => {
		const map = new LWWMap({ name: new LWWRegister("Alice"), age: new LWWRegister(25) });
		const callback1 = vi.fn();
		const callback2 = vi.fn();

		map.subscribe(callback1);
		map.subscribe(callback2);

		map.age = 30;

		expect(callback1).toHaveBeenCalledTimes(1);
		expect(callback2).toHaveBeenCalledTimes(1);
	});
});
