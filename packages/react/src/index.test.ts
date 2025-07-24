import { describe, expect, it } from "vitest";
import { createStore } from "./index";

describe("useStore", () => {
	it("should create a store", async () => {
		const store = await createStore({
			schema: {},
		});

		expect(store).toHaveProperty("events");
		expect(store).toMatchInlineSnapshot(`
			Store {
			  "_remote": undefined,
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

	it.todo("should use store");
});
