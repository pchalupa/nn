import { Collection } from "@nn/entities/Collection";
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
			  "_remote": undefined,
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			  "snapshotManager": SnapshotManager {
			    "snapshots": Map {},
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
			  "_remote": undefined,
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			  "snapshotManager": SnapshotManager {
			    "snapshots": Map {},
			  },
			  "state": {
			    "testCollection": Collection {
			      "data": [],
			      "eventEmitter": EventEmitter {
			        "events": Map {},
			      },
			      "events": EventEmitter {
			        "events": Map {},
			      },
			    },
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

	it("should return a snapshot", async () => {
		const store = new Store({
			testCollection: new Collection<{ id: string }>(),
		});
		const selector = (schema: { testCollection: Collection<{ id: string }> }) => schema.testCollection;
		const snapshot = store.getSnapshotOf(selector);

		expect(snapshot).toBeInstanceOf(Collection);
		expect(store.getSnapshotIdOf(selector)).toBeDefined();
		expect(snapshot).toMatchInlineSnapshot(`
			Collection {
			  "data": [],
			  "eventEmitter": EventEmitter {
			    "events": Map {
			      "update" => Set {
			        [Function],
			      },
			    },
			  },
			  "events": EventEmitter {
			    "events": Map {},
			  },
			}
		`);
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
