import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { Time } from "@nn/time";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IndexDb } from "./index-db";
import { IndexDbSync } from "./index-db-sync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const read = async (name: string, field: string) => {
	const repository = new IndexDb(name);

	await repository.init(schema.properties);

	const entry = await repository.get(field);

	repository.close();

	return entry;
};

const attach = async (store: Store, name?: string) => {
	const set = vi.spyOn(IndexDb.prototype, "set");
	const indexDbSync = IndexDbSync.attach(store, name);

	await vi.waitFor(() => {
		expect(set).toHaveBeenCalled();
	});
	set.mockRestore();

	return indexDbSync;
};

describe("IndexDbSync", () => {
	afterEach(() => vi.restoreAllMocks());

	it("opens a database under the given name with a store for each field", async () => {
		const name = crypto.randomUUID();
		const open = vi.spyOn(indexedDB, "open");
		const indexDbSync = await attach(new Store(schema), name);

		indexDbSync.detach();

		expect(open).toHaveBeenCalledExactlyOnceWith(name, undefined);

		const database = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open(name);

			request.onsuccess = () => resolve(request.result);
		});

		expect([...database.objectStoreNames]).toStrictEqual(["language", "tickets"]);

		database.close();
	});

	it("opens the default database when no name is given", async () => {
		const indexDbSync = await attach(new Store(schema));

		indexDbSync.detach();

		const databases = await indexedDB.databases();

		expect(databases.map((database) => database.name)).toContain("nn-default");
	});

	it("restores each field from the database by name", async () => {
		const name = crypto.randomUUID();
		const repository = new IndexDb(name);

		await repository.init(schema.properties);
		await repository.set("language", new LWWRegister("cs", "language", Time.now()).encode());
		repository.close();

		const store = new Store(schema);
		const indexDbSync = await attach(store, name);

		expect(store.state.read().language).toBe("cs");

		indexDbSync.detach();
	});

	it("stores every field on connecting and each later change", async () => {
		const name = crypto.randomUUID();
		const store = new Store(schema);
		const indexDbSync = await attach(store, name);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(async () => {
			expect(await read(name, "language")).toMatchObject({ key: "language", data: "cs" });
		});
		expect(await read(name, "tickets")).toMatchObject({ key: "tickets" });

		indexDbSync.detach();
	});

	it("keeps the stored fields for the next attach", async () => {
		const name = crypto.randomUUID();
		const first = new Store(schema);
		const indexDbSync = await attach(first, name);

		first.state.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(async () => {
			expect(await read(name, "language")).toMatchObject({ data: "cs" });
		});

		indexDbSync.detach();

		const second = new Store(schema);

		await attach(second, name);

		expect(second.state.read().language).toBe("cs");
	});

	it("reads and writes nothing when the database cannot be opened", async () => {
		vi.spyOn(indexedDB, "open").mockImplementation(() => {
			throw new Error("blocked");
		});

		const transaction = vi.spyOn(IDBDatabase.prototype, "transaction");
		const store = new Store(schema);
		const indexDbSync = IndexDbSync.attach(store, crypto.randomUUID());
		const delegate = { syncEngineDidFail: vi.fn() };

		indexDbSync.delegate = delegate;

		await vi.waitFor(() => {
			expect(delegate.syncEngineDidFail).toHaveBeenCalledOnce();
		});

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transaction).not.toHaveBeenCalled();
		expect(() => indexDbSync.detach()).not.toThrow();
	});

	it("reopens the database and keeps storing changes when another connection upgrades it", async () => {
		const name = crypto.randomUUID();
		const store = new Store(schema);
		const indexDbSync = await attach(store, name);
		const newer = new IndexDb(name);

		await newer.init({ ...schema.properties, posts: {} });
		newer.close();

		store.state.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(async () => {
			expect(await read(name, "language")).toMatchObject({ data: "cs" });
		});

		indexDbSync.detach();
	});

	it("stops syncing without recreating the database when another connection deletes it", async () => {
		const name = crypto.randomUUID();
		const store = new Store(schema);
		const indexDbSync = await attach(store, name);
		const open = vi.spyOn(indexedDB, "open");
		const set = vi.spyOn(IndexDb.prototype, "set");

		await new Promise((resolve, reject) => {
			const request = indexedDB.deleteDatabase(name);

			request.onsuccess = resolve;
			request.onerror = reject;
		});

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect((await indexedDB.databases()).map((database) => database.name)).not.toContain(name);
		expect(set).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();

		indexDbSync.detach();
	});

	it("closes the database on detach", async () => {
		const indexDbSync = await attach(new Store(schema), crypto.randomUUID());
		const close = vi.spyOn(IDBDatabase.prototype, "close");

		indexDbSync.detach();

		expect(close).toHaveBeenCalledOnce();
	});

	it("closes a database that finishes opening after detach", async () => {
		const close = vi.spyOn(IDBDatabase.prototype, "close");
		const indexDbSync = IndexDbSync.attach(new Store(schema), crypto.randomUUID());

		indexDbSync.detach();

		await vi.waitFor(() => {
			expect(close).toHaveBeenCalledOnce();
		});

		await new Promise((resolve) => setTimeout(resolve));

		expect(close).toHaveBeenCalledOnce();
	});
});
