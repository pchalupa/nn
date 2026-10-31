import type { Entry } from "@nn/repository";
import { RepositoryNotInitializedError } from "@nn/repository/errors/RepositoryNotInitializedError";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndexDbRepository } from "./IndexDbRepository";

describe("IndexDbRepository", () => {
	const entry: Entry = { key: "language", data: "cs", metadata: { kind: "register" } };

	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
	});

	afterEach(() => vi.restoreAllMocks());

	it("requires initialization before reading or writing", async () => {
		const repository = new IndexDbRepository();

		await expect(repository.get("language")).rejects.toBeInstanceOf(RepositoryNotInitializedError);
		await expect(repository.set("language", entry)).rejects.toBeInstanceOf(RepositoryNotInitializedError);
	});

	it("creates a store for every key in the schema", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ users: {}, posts: {} });

		expect(await repository.getAll("users")).toStrictEqual([]);
		expect(await repository.getAll("posts")).toStrictEqual([]);
	});

	it("rejects an unfinished write when a newer write to the same name starts", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ language: {} });

		const abort = vi.spyOn(IDBTransaction.prototype, "abort");
		const first = repository.set("language", entry);
		const second = repository.set("language", { ...entry, data: "en" });

		await expect(first).rejects.toMatchObject({ name: "AbortError" });
		await expect(second).resolves.toBeUndefined();
		expect(abort).toHaveBeenCalledOnce();
		expect(await repository.get("language")).toStrictEqual({ ...entry, data: "en" });
	});

	it("adds a missing store to an existing database via a version upgrade", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ language: {} });
		await repository.set("language", entry);
		await repository.init({ language: {}, posts: {} });

		expect(await repository.get("language")).toStrictEqual(entry);
		expect(await repository.getAll("posts")).toStrictEqual([]);
	});

	it("returns undefined for a name that is not stored", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ language: {} });

		expect(await repository.get("language")).toBeUndefined();
	});

	it("stores, reads back and overwrites an entry under its name", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ language: {} });

		await repository.set("language", entry);
		expect(await repository.get("language")).toStrictEqual(entry);

		await repository.set("language", { ...entry, data: "en" });
		expect(await repository.getAll("language")).toStrictEqual([{ ...entry, data: "en" }]);
	});

	it("deletes the entry stored under a key and keeps the others", async () => {
		const repository = new IndexDbRepository();

		await repository.init({ language: {}, theme: {} });
		await repository.set("language", entry);
		await repository.set("theme", { ...entry, key: "theme", data: "dark" });

		await repository.delete("language", "language");

		expect(await repository.get("language")).toBeUndefined();
		expect(await repository.get("theme")).toStrictEqual({ ...entry, key: "theme", data: "dark" });
	});
});
