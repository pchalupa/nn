import { describe, expect, it, vi } from "vitest";
import { Snapshot } from "./Snapshot";
import { Store } from "./Store";

describe("Store", () => {
	it("should create a store", () => {
		const store = new Store({});

		expect(store).toHaveProperty("repositoryManager");
		expect(store).toHaveProperty("snapshotManager");
		expect(store).toHaveProperty("state");
		expect(store).toHaveProperty("subscribers");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "repositoryManager": undefined,
			  "snapshotManager": SnapshotManager {
			    "snapshots": Map {},
			  },
			  "state": {},
			  "subscribers": Subscribers {
			    "subscribers": Map {},
			  },
			}
		`);
	});

	it("should create a store with a factory method", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }, { ephemeral }) => ({
				testCollection: collection({ repository: ephemeral }),
			}),
		});

		expect(store).toBeInstanceOf(Store);
		expect(store).toHaveProperty("repositoryManager");
		expect(store).toHaveProperty("snapshotManager");
		expect(store).toHaveProperty("state");
		expect(store).toHaveProperty("subscribers");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "repositoryManager": RepositoryManager {
			    "repositories": Map {
			      "ephemeral" => InMemoryRepository {
			        "data": Map {},
			        "events": Map {
			          "didSet" => Set {
			            [Function],
			          },
			        },
			      },
			    },
			  },
			  "snapshotManager": SnapshotManager {
			    "snapshots": Map {},
			  },
			  "state": {
			    "testCollection": Collection {
			      "data": [],
			      "parent": undefined,
			      "repository": InMemoryRepository {
			        "data": Map {},
			        "events": Map {
			          "didSet" => Set {
			            [Function],
			          },
			        },
			      },
			    },
			  },
			  "subscribers": Subscribers {
			    "subscribers": Map {},
			  },
			}
		`);
	});

	it("should return a snapshot", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection<{ id: string }>(),
			}),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);

		expect(snapshot).toBeInstanceOf(Snapshot);
		expect(snapshot).toHaveProperty("data");
		expect(snapshot).toMatchInlineSnapshot(`
			Snapshot {
			  "data": Collection {
			    "data": [],
			    "parent": undefined,
			    "repository": InMemoryRepository {
			      "data": Map {},
			      "events": Map {
			        "didSet" => Set {
			          [Function],
			        },
			      },
			    },
			  },
			  "delegate": SnapshotDelegate {
			    "didPush": [Function],
			  },
			}
		`);
	});

	it("should select a data and return snapshot", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection<{ id: string }>(),
			}),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection.filter((item) => item.id === "1"));

		snapshot.push({ id: "1" });

		expect(snapshot).toMatchInlineSnapshot(`
			Snapshot {
			  "data": Collection {
			    "data": [],
			    "parent": Collection {
			      "data": [
			        {
			          "resolve": undefined,
			        },
			      ],
			      "parent": undefined,
			      "repository": InMemoryRepository {
			        "data": Map {
			          "1" => {
			            "id": "1",
			          },
			        },
			        "events": Map {
			          "didSet" => Set {
			            [Function],
			          },
			        },
			      },
			    },
			    "repository": undefined,
			  },
			  "delegate": SnapshotDelegate {
			    "didPush": [Function],
			  },
			}
		`);
	});

	it("should notify subscribers when a snapshot is updated", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection<{ id: string }>(),
			}),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);
		const listener = vi.fn();

		store.addSubscriber("test", listener);
		snapshot.push({ id: "1" });

		expect(listener).toHaveBeenCalled();
	});

	it("should remove a subscriber", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection<{ id: string }>(),
			}),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);
		const listener = vi.fn();

		store.addSubscriber("test", listener);
		store.removeSubscriber("test");

		snapshot.push({ id: "1" });

		expect(listener).not.toHaveBeenCalled();
	});
});
