import type { Encoded } from "@nn/entities/Codable";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { RepositoryNotInitializedError } from "./errors/RepositoryNotInitializedError";
import { IndexDb } from "./IndexDb";

describe("IndexDb", () => {
	const entry: Encoded = { key: "language", data: "cs", metadata: { kind: "register" } };

	beforeEach(() => {
		globalThis.indexedDB = new IDBFactory();
	});

	afterEach(() => vi.restoreAllMocks());

	it("requires initialization before reading or writing", async () => {
		const indexDb = new IndexDb();

		await expect(indexDb.get("language")).rejects.toBeInstanceOf(RepositoryNotInitializedError);
		await expect(indexDb.set("language", entry)).rejects.toBeInstanceOf(RepositoryNotInitializedError);
	});

	it("creates a store for every key in the schema", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ users: {}, posts: {} });

		expect(await indexDb.getAll("users")).toStrictEqual([]);
		expect(await indexDb.getAll("posts")).toStrictEqual([]);
	});

	it("rejects an unfinished write when a newer write to the same name starts", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {} });

		const abort = vi.spyOn(IDBTransaction.prototype, "abort");
		const first = indexDb.set("language", entry);
		const second = indexDb.set("language", { ...entry, data: "en" });

		await expect(first).rejects.toMatchObject({ name: "AbortError" });
		await expect(second).resolves.toBeUndefined();
		expect(abort).toHaveBeenCalledOnce();
		expect(await indexDb.get("language")).toStrictEqual({ ...entry, data: "en" });
	});

	it("adds a missing store to an existing database via a version upgrade", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {} });
		await indexDb.set("language", entry);
		await indexDb.init({ language: {}, posts: {} });

		expect(await indexDb.get("language")).toStrictEqual(entry);
		expect(await indexDb.getAll("posts")).toStrictEqual([]);
	});

	it("opens a new database once", async () => {
		const indexDb = new IndexDb();
		const open = vi.spyOn(indexedDB, "open");

		await indexDb.init({ language: {} });

		expect(open).toHaveBeenCalledOnce();
	});

	it("reopens an existing database once to add a missing store", async () => {
		const previous = new IndexDb();

		await previous.init({ language: {} });
		await previous.init({ language: {}, theme: {} });
		previous.close();

		const indexDb = new IndexDb();
		const open = vi.spyOn(indexedDB, "open");

		await indexDb.init({ language: {}, theme: {}, posts: {} });

		expect(open).toHaveBeenCalledTimes(2);
		expect(await indexDb.getAll("posts")).toStrictEqual([]);
	});

	it("returns undefined for a name that is not stored", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {} });

		expect(await indexDb.get("language")).toBeUndefined();
	});

	it("stores, reads back and overwrites an entry under its name", async () => {
		const indexDb = new IndexDb();

		expectTypeOf(indexDb.set).parameter(1).toEqualTypeOf<Encoded>();

		await indexDb.init({ language: {} });

		await indexDb.set("language", entry);
		const stored = await indexDb.get("language");

		expectTypeOf(stored).toEqualTypeOf<Encoded | undefined>();
		expect(stored).toStrictEqual(entry);

		await indexDb.set("language", { ...entry, data: "en" });
		const entries = await indexDb.getAll("language");

		expectTypeOf(entries).toEqualTypeOf<Encoded[]>();
		expect(entries).toStrictEqual([{ ...entry, data: "en" }]);
	});

	it("requires initialization again after closing and keeps what was stored", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {} });
		await indexDb.set("language", entry);
		indexDb.close();

		await expect(indexDb.get("language")).rejects.toBeInstanceOf(RepositoryNotInitializedError);

		await indexDb.init({ language: {} });

		expect(await indexDb.get("language")).toStrictEqual(entry);
	});

	it("finishes a write that started before closing", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {} });

		const write = indexDb.set("language", entry);

		indexDb.close();
		await write;
		await indexDb.init({ language: {} });

		expect(await indexDb.get("language")).toStrictEqual(entry);
	});

	it("deletes the entry stored under a key and keeps the others", async () => {
		const indexDb = new IndexDb();

		await indexDb.init({ language: {}, theme: {} });
		await indexDb.set("language", entry);
		await indexDb.set("theme", { ...entry, key: "theme", data: "dark" });

		await indexDb.delete("language", "language");

		expect(await indexDb.get("language")).toBeUndefined();
		expect(await indexDb.get("theme")).toStrictEqual({ ...entry, key: "theme", data: "dark" });
	});
});
