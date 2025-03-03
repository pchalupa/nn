import { describe, expect, it } from "vitest";
import { Collection } from "./Collection";

describe("Collection", () => {
	it("should create a collection", () => {
		const collection = new Collection();

		expect(collection).toMatchInlineSnapshot(`
			Collection {
			  "data": [],
			  "events": Map {},
			  "parent": undefined,
			  "repository": undefined,
			  Symbol(Symbol.toStringTag): "Collection",
			}
		`);
	});

	it("should push to the collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection).toMatchInlineSnapshot(`
			Collection {
			  "data": [],
			  "events": Map {},
			  "parent": undefined,
			  "repository": undefined,
			  Symbol(Symbol.toStringTag): "Collection",
			}
		`);
	});

	it("should return the length of collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection.length).toBe(1);
	});

	it("should map the collection", () => {
		const collection = new Collection<{ id: string }>();

		collection.push({ id: "1" });

		const mapped = collection.map((data) => data.id);

		expect(mapped).toStrictEqual(["1"]);
	});

	it("should filter the collection", () => {
		const collection = new Collection<{ id: string }>();

		collection.push({ id: "1" });
		collection.push({ id: "2" });

		const filtered = collection.filter((data) => data.id === "1");

		expect(filtered.findRoot()).toBe(collection);
		expect(filtered).toMatchInlineSnapshot(`
			Collection {
			  "data": [],
			  "events": Map {},
			  "parent": Collection {
			    "data": [],
			    "events": Map {},
			    "parent": undefined,
			    "repository": undefined,
			    Symbol(Symbol.toStringTag): "Collection",
			  },
			  "repository": undefined,
			  Symbol(Symbol.toStringTag): "Collection",
			}
		`);
	});
});
