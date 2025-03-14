import { describe, expect, it, vi } from "vitest";
import { LocalStorageRepository } from "./LocalStorageRepository";

describe("LocalStorageRepository", () => {
	it("should create a local storage repository", () => {
		const repository = new LocalStorageRepository();

		expect(repository).toHaveProperty("data");
		expect(repository).toHaveProperty("get");
		expect(repository).toHaveProperty("set");
		expect(repository).toMatchInlineSnapshot();
	});

	it("should set and get a value", () => {
		const repository = new LocalStorageRepository();

		repository.set("test", "value");

		expect(repository.get("test")).toBe("value");
	});
});
