import { Collection } from "@nn/entities/Collection";
import { describe, expect, it } from "vitest";
import { Snapshot } from "./Snapshot";

describe("Snapshot", () => {
	it("should create a snapshot", () => {
		const collection = new Collection();
		const snapshot = Snapshot.createSnapshot(collection);

		expect(snapshot).toHaveProperty("id");
		expect(snapshot).toHaveProperty("state");
		expect(snapshot).toMatchInlineSnapshot(`
			Collection {
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "state": Collection {
			    "data": [],
			    "eventEmitter": EventEmitter {
			      "events": Map {},
			    },
			    "events": EventEmitter {
			      "events": Map {},
			    },
			  },
			}
		`);
	});

	it("should return the snapshot id", () => {
		const collection = new Collection();
		const snapshot = Snapshot.createSnapshot(collection);

		expect(snapshot.id).toBe(snapshot.id);
	});
});
