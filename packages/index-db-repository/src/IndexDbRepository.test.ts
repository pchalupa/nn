import { describe, expect, it } from "vitest";
import { IndexDbRepository } from "./IndexDbRepository";

describe("IndexDbRepository", () => {
	it("should create a repository", async () => {
		const repository = await IndexDbRepository.createRepository([]);

		expect(repository).toBeInstanceOf(IndexDbRepository);
		expect(repository).toHaveProperty("repository");
	});

	it("should set and get a value", async () => {
		const repository = await IndexDbRepository.createRepository(["testType"]);
		const typeName = "testType";
		const id = "testId";
		const value = { name: "Test" };

		await repository.set(id, value, typeName);
		const result = await repository.getAll(typeName);

		expect(result).toEqual([value]);
	});
});
