import { bench, describe, expect, it } from "vitest";
import { Store } from "./Store";

describe("Store", () => {
	it("should create a store", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection(),
			}),
		});

		expect(store).toMatchInlineSnapshot(`
			Store {
			  "repository": InMemoryRepository {
			    "data": Map {},
			  },
			  "snapshotManager": SnapshotManager {
			    "snapshots": Map {},
			  },
			  "state": {
			    "testCollection": Collection {
			      "data": [],
			      "parent": undefined,
			    },
			  },
			  "subscribers": Subscribers {
			    "subscribers": Map {},
			  },
			}
		`);
	});

	it("should create a store with empty schema", () => {
		const store = Store.createWithOptions({
			schema: () => ({}),
		});

		expect(store).toMatchInlineSnapshot(`
			Store {
			  "repository": InMemoryRepository {
			    "data": Map {},
			  },
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

	it("should return a snapshot", () => {
		const store = Store.createWithOptions({
			schema: ({ collection }) => ({
				testCollection: collection<{ id: string }>(),
			}),
		});
		const snapshot = store.getSnapshotOf((schema) => schema.testCollection);

		expect(snapshot).toMatchInlineSnapshot(`
			Snapshot {
			  "data": Collection {
			    "data": [],
			    "parent": undefined,
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
			    "data": [
			      {
			        "id": "1",
			      },
			    ],
			    "parent": Collection {
			      "data": [
			        {
			          "resolve": undefined,
			        },
			      ],
			      "parent": undefined,
			    },
			  },
			  "delegate": SnapshotDelegate {
			    "didPush": [Function],
			  },
			}
		`);
	});
});
