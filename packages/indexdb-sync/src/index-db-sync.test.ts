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

describe("IndexDbSync", () => {
	afterEach(() => vi.restoreAllMocks());

	it("opens a database under the given name with a store for each field", async () => {
		const name = crypto.randomUUID();
		const open = vi.spyOn(indexedDB, "open");
		const indexDbSync = await IndexDbSync.attach(new Store(schema), name);

		indexDbSync.detach();

		expect(open).toHaveBeenCalledExactlyOnceWith(name, 1);

		const database = await new Promise<IDBDatabase>((resolve) => {
			const request = indexedDB.open(name);

			request.onsuccess = () => resolve(request.result);
		});

		expect([...database.objectStoreNames]).toStrictEqual(["language", "tickets"]);

		database.close();
	});

	it("opens the default database when no name is given", async () => {
		const indexDbSync = await IndexDbSync.attach(new Store(schema));

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
		const indexDbSync = await IndexDbSync.attach(store, name);

		expect(store.state.read().language).toBe("cs");

		indexDbSync.detach();
	});

	it("persists each changed field under its name", async () => {
		const name = crypto.randomUUID();
		const store = new Store(schema);
		const indexDbSync = await IndexDbSync.attach(store, name);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(async () => {
			expect(await read(name, "language")).toMatchObject({ key: "language", data: "cs" });
		});
		expect(await read(name, "tickets")).toBeUndefined();

		indexDbSync.detach();
	});

	it("keeps the stored fields for the next attach", async () => {
		const name = crypto.randomUUID();
		const first = new Store(schema);
		const indexDbSync = await IndexDbSync.attach(first, name);

		first.state.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(async () => {
			expect(await read(name, "language")).toMatchObject({ data: "cs" });
		});

		indexDbSync.detach();

		const second = new Store(schema);

		await IndexDbSync.attach(second, name);

		expect(second.state.read().language).toBe("cs");
	});

	it("reads and writes nothing when the database cannot be opened", async () => {
		vi.spyOn(indexedDB, "open").mockImplementation(() => {
			throw new Error("blocked");
		});

		const transaction = vi.spyOn(IDBDatabase.prototype, "transaction");
		const store = new Store(schema);
		const indexDbSync = await IndexDbSync.attach(store, crypto.randomUUID());

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transaction).not.toHaveBeenCalled();
		expect(() => indexDbSync.detach()).not.toThrow();
	});

	it("closes the database on detach", async () => {
		const indexDbSync = await IndexDbSync.attach(new Store(schema), crypto.randomUUID());
		const close = vi.spyOn(IDBDatabase.prototype, "close");

		indexDbSync.detach();

		expect(close).toHaveBeenCalledOnce();
	});
});
