import { describe, expect, it } from "vitest";
import { LWWMap } from "./LWWMap";

describe("LWWMap", () => {
	it("should create a map with initial value", () => {
		const map = new LWWMap({ name: "John", age: 30 });

		expect(map.name).toBe("John");
		expect(map).toBeInstanceOf(LWWMap);
		expect(map.toString()).toBe("[object LWWMap]");
	});

	it("should update property value and reflect changes", () => {
		const map = new LWWMap({ name: "Alice", age: 25 });

		expect(map.name).toBe("Alice");
		expect(map.age).toBe(25);

		map.name = "Bob";
		map.age = 40;

		expect(map.name).toBe("Bob");
		expect(map.age).toBe(40);
	});

	it("should merge maps with multiple properties", () => {
		const mapA = new LWWMap({ name: "foo", age: 20 });
		const mapB = new LWWMap({ name: "bar", age: 30 });

		const result = mapA.merge(mapB);

		expect(result.name).toBe("bar");
		expect(result.age).toBe(30);
	});
});
