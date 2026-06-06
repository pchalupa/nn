import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexDbRepository } from "./IndexDbRepository";

describe("IndexDbRepository", () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
	});

	it("should create a repository", async () => {
		const repository = new IndexDbRepository();

		await repository.init({});

		expect(repository).toBeInstanceOf(IndexDbRepository);
	});

	it("should create a store for every key in the schema", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ users: {}, posts: {} });

		expect(await repository.getAll("users")).toEqual([]);
		expect(await repository.getAll("posts")).toEqual([]);
	});

	it("should add a missing store to an existing database via a version upgrade", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ users: {} });
		await repository.set("id", "value", "users");

		await repository.init({ users: {}, posts: {} });

		expect(await repository.getAll("users")).toEqual(["value"]);
		expect(await repository.getAll("posts")).toEqual([]);
	});

	it("should store and read back a value", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("id", "value", "test");

		expect(await repository.getAll("test")).toEqual(["value"]);
	});

	it("should return an empty array for a store with no values", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		expect(await repository.getAll("test")).toEqual([]);
	});

	it("should return every value stored under a type", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("a", { name: "A" }, "test");
		await repository.set("b", { name: "B" }, "test");

		expect(await repository.getAll("test")).toEqual([{ name: "A" }, { name: "B" }]);
	});

	it("should overwrite the value stored under an existing id", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("id", "first", "test");
		await repository.set("id", "second", "test");

		expect(await repository.getAll("test")).toEqual(["second"]);
	});
});
