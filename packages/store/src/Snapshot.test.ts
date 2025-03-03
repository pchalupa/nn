import { describe, expect, it } from "vitest";
import { Collection } from "./Collection";
import { Snapshot } from "./Snapshot";

describe("Snapshot", () => {
	it("should create a snapshot", () => {
		const collection = new Collection();
		const snapshot = Snapshot.createSnapshot(collection);

		expect(snapshot).toHaveProperty("id");
		expect(snapshot).toHaveProperty("state");
		expect(snapshot).toMatchInlineSnapshot(`
			Collection {
			  "events": Map {},
			  "state": Collection {
			    "data": [],
			    "events": Map {},
			    "parent": undefined,
			    "repository": undefined,
			    Symbol(Symbol.toStringTag): "Collection",
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
