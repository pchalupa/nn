import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "./InMemoryRepository";

describe("InMemoryRepository", () => {
	it("should create an in memory repository", () => {
		const repository = new InMemoryRepository();

		expect(repository).toHaveProperty("data");
		expect(repository).toMatchInlineSnapshot(`
			InMemoryRepository {
			  "data": Map {},
			  "events": Map {},
			}
		`);
	});

	it("should set and get a value", () => {
		const repository = new InMemoryRepository();

		repository.set("test", "value");

		expect(repository.get("test")).toBe("value");
	});

	it("should emit an event when setting a value", () => {
		const repository = new InMemoryRepository();
		const listener = vi.fn();

		repository.on("didSet", listener);
		repository.set("test", "value");

		expect(listener).toHaveBeenCalledWith("test", "value");
	});
});
