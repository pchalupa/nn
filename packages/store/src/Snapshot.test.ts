import { Collection } from "@nn/entities/Collection";
import { describe, expect, it } from "vitest";

import { Snapshot } from "./Snapshot";

describe("Snapshot", () => {
	it("should create a snapshot", () => {
		const collection = new Collection();
		const snapshot = new Snapshot(collection);

		expect(snapshot).toHaveProperty("id");
		expect(snapshot).toHaveProperty("state");
		expect(snapshot).toMatchInlineSnapshot(`
			Snapshot {
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "state": [],
			}
		`);
	});

	it("should return the snapshot id", () => {
		const collection = new Collection();
		const snapshot = new Snapshot(collection);

		expect(snapshot.id).toBe(snapshot.id);
	});
});
