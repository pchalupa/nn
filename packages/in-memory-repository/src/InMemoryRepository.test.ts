import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "./InMemoryRepository";

describe("InMemoryRepository", () => {
	it("should create an in memory repository", () => {
		const repository = new InMemoryRepository();

		expect(repository).toHaveProperty("data");
		expect(repository).toHaveProperty("get");
		expect(repository).toHaveProperty("set");
		expect(repository).toMatchInlineSnapshot(`
			InMemoryRepository {
			  "data": Map {},
			}
		`);
	});

	it("should set and get a value", () => {
		const repository = new InMemoryRepository();

		repository.set("test", "value");

		expect(repository.get("test")).toBe("value");
	});
});
