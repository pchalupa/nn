import { Collection } from "@nn/entities/Collection";
import { describe, expect, it, vi } from "vitest";
import { Snapshot } from "./Snapshot";
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

	it("should return a snapshot", async () => {
		const store = new Store({
			testCollection: new Collection<{ id: string }>(),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);

		expect(snapshot).toBeInstanceOf(Snapshot);
		expect(snapshot).toHaveProperty("state");
		expect(snapshot).toMatchInlineSnapshot(`
			Collection {
			  "events": EventEmitter {
			    "events": Map {
			      "invalidated" => Set {
			        [Function],
			        [Function],
			      },
			    },
			  },
			  "state": Collection {
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
