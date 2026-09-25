import { Collection } from "@nn/entities/Collection";
import { LWWRegister } from "@nn/entities/LWWRegister";
import type { Repository } from "@nn/repository";
import { array, object, string } from "@nn/schema";
import { describe, expect, it, vi } from "vitest";

import { Store } from "./Store";

describe("Store", () => {
	it("should create a store", () => {
		const store = new Store({});

		expect(store).toHaveProperty("snapshotManager");
		expect(store).toHaveProperty("state");
		expect(store).toHaveProperty("events");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			  "snapshotManager": SnapshotManager {
			    "snapshots": WeakMap {},
			  },
			  "state": {},
			}
		`);
	});

	it("should create a store with a factory method", async () => {
		const store = new Store({
			testCollection: new Collection(),
		});

		expect(store).toBeInstanceOf(Store);
		expect(store).toHaveProperty("snapshotManager");
		expect(store).toHaveProperty("state");
		expect(store).toHaveProperty("events");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			  "snapshotManager": SnapshotManager {
			    "snapshots": WeakMap {},
			  },
			  "state": {
			    "testCollection": [],
			  },
			}
		`);
	});

	it("should create a store from a schema", async () => {
		const store = await Store.fromSchema({
			schema: object({
				testCollection: array(object({ name: string() })),
			}),
		});
		const collection = store.getSnapshotOf((state) => state.testCollection);

		expect(store).toBeInstanceOf(Store);
		expect(collection.current).toEqual([]);
	});

	it("should initialize and hydrate a store from a repository", async () => {
		const data = [{ id: "1", name: "Test" }];
		const repository: Repository = {
			init: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(undefined),
			getAll: vi.fn().mockResolvedValue(data),
			set: vi.fn().mockResolvedValue(undefined),
		};
		const schema = object({
			testCollection: array(object({ name: string() })),
		});

		const store = await Store.fromSchema({ schema, repository });
		const collection = store.getSnapshotOf((state) => state.testCollection);

		expect(repository.init).toHaveBeenCalledWith(schema.properties);
		expect(repository.getAll).toHaveBeenCalledWith("testCollection");
		expect(collection.current).toEqual(data);
	});

	it("should create a register for a top-level primitive", async () => {
		const store = await Store.fromSchema({
			schema: object({ language: string() }),
		});
		const language = store.getSnapshotOf((state) => state.language);

		expect(language).toBeInstanceOf(LWWRegister);
		expect(language.current).toBeUndefined();
	});

	it("should hydrate and persist a register through a repository", async () => {
		const repository: Repository = {
			init: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue("cs"),
			getAll: vi.fn().mockResolvedValue([]),
			set: vi.fn().mockResolvedValue(undefined),
		};

		const store = await Store.fromSchema({ schema: object({ language: string() }), repository });
		const language = store.getSnapshotOf((state) => state.language);

		expect(repository.get).toHaveBeenCalledWith("language", "language");
		expect(language.current).toBe("cs");

		language.current = "en";

		expect(repository.set).toHaveBeenCalledWith("language", "en", "language");
	});

	it("should emit an error when persisting a register fails", async () => {
		const error = new Error("Write failed");
		const repository: Repository = {
			init: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(undefined),
			getAll: vi.fn().mockResolvedValue([]),
			set: vi.fn().mockRejectedValue(error),
		};
		const listener = vi.fn();

		const store = await Store.fromSchema({ schema: object({ language: string() }), repository });
		const language = store.getSnapshotOf((state) => state.language);

		store.events.on("error", listener);

		language.current = "en";

		await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(error));
	});

	it("should reject a top-level object", async () => {
		await expect(Store.fromSchema({ schema: object({ settings: object({ theme: string() }) }) })).rejects.toThrow(
			TypeError,
		);
	});

	it("should return a snapshot", async () => {
		const store = new Store({
			testCollection: new Collection<{ id: string }>(),
		});
		const selector = (schema: { testCollection: Collection<{ id: string }> }) => schema.testCollection;
		const snapshot = store.getSnapshotOf(selector);

		expect(snapshot).toBeInstanceOf(Collection);
		expect(store.getSnapshotIdOf(selector)).toBeDefined();
		expect(snapshot).toMatchInlineSnapshot(`[]`);
	});

	it("should select a data and return snapshot", async () => {
		const collection = new Collection<{ id: string }>();
		const store = new Store({ testCollection: collection });

		collection.push({ id: "1" });
		collection.push({ id: "2" });

		const filtered = store.getSnapshotOf((schema) => schema.testCollection.filter((item) => item.id === "1"));

		expect(filtered.length).toBe(1);
		expect(filtered.current).toStrictEqual([{ id: "1" }]);
	});

	it("should notify subscribers when a snapshot is updated", async () => {
		const store = new Store({
			testCollection: new Collection<{ id: string }>(),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);
		const listener = vi.fn();

		store.events.on("update", listener);

		snapshot.push({ id: "1" });

		expect(listener).toHaveBeenCalled();
	});

	it("should remove a subscriber", async () => {
		const store = new Store({
			testCollection: new Collection<{ id: string }>(),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);
		const listener = vi.fn();

		store.events.on("update", listener);
		store.events.off("update", listener);

		snapshot.push({ id: "1" });

		expect(listener).not.toHaveBeenCalled();
	});
});
