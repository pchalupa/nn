import { beforeEach, describe, expect, it } from "vitest";

import { IndexDbRepository } from "./IndexDbRepository";

describe("IndexDbRepository", () => {
	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
	});

	it("creates a repository", async () => {
		const repository = new IndexDbRepository();

		await repository.init({});

		expect(repository).toBeInstanceOf(IndexDbRepository);
	});

	it("creates a store for every key in the schema", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ users: {}, posts: {} });

		expect(await repository.getAll("users")).toStrictEqual([]);
		expect(await repository.getAll("posts")).toStrictEqual([]);
	});

	it("adds a missing store to an existing database via a version upgrade", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ users: {} });
		await repository.set("id", "value", "users");

		await repository.init({ users: {}, posts: {} });

		expect(await repository.getAll("users")).toStrictEqual(["value"]);
		expect(await repository.getAll("posts")).toStrictEqual([]);
	});

	it("stores and read back a value", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("id", "value", "test");

		expect(await repository.getAll("test")).toStrictEqual(["value"]);
	});

	it("reads back a single value by its id", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("a", { name: "A" }, "test");
		await repository.set("b", { name: "B" }, "test");

		expect(await repository.get("a", "test")).toStrictEqual({ name: "A" });
		expect(await repository.get("b", "test")).toStrictEqual({ name: "B" });
	});

	it("returns undefined for an id that is not stored", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		expect(await repository.get("missing", "test")).toBeUndefined();
	});

	it("returns an empty array for a store with no values", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		expect(await repository.getAll("test")).toStrictEqual([]);
	});

	it("returns every value stored under a type", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("a", { name: "A" }, "test");
		await repository.set("b", { name: "B" }, "test");

		expect(await repository.getAll("test")).toStrictEqual([{ name: "A" }, { name: "B" }]);
	});

	it("overwrites the value stored under an existing id", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("id", "first", "test");
		await repository.set("id", "second", "test");

		expect(await repository.getAll("test")).toStrictEqual(["second"]);
	});

	it("deletes the value stored under an id and keep the others", async () => {
		const repository = new IndexDbRepository();
		await repository.init({ test: {} });

		await repository.set("a", { name: "A" }, "test");
		await repository.set("b", { name: "B" }, "test");

		await repository.delete("a", "test");

		expect(await repository.get("a", "test")).toBeUndefined();
		expect(await repository.getAll("test")).toStrictEqual([{ name: "B" }]);
	});
});
