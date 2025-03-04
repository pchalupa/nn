import { describe, expect, it } from "vitest";
import { createStore } from "./index";

describe("useStore", () => {
	it("should create a store", () => {
		const store = createStore({
			schema: () => ({}),
		});

		expect(store).toHaveProperty("getSnapshotOf");
		expect(store).toHaveProperty("addSubscriber");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repositoryManager": RepositoryManager {
			    "repositories": Map {
			      "ephemeral" => InMemoryRepository {
			        "data": Map {},
			        "events": EventEmitter {
			          "events": Map {},
			        },
			      },
			    },
			  },
			  "snapshotManager": SnapshotManager {
			    "snapshots": WeakMap {},
			  },
			  "state": {},
			}
		`);
	});
});
