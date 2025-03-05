import { InMemoryRepository } from "@nn/in-memory-repository";
import { describe, expect, it } from "vitest";
import { Collection, Slice } from "./Collection";

describe("Collection", () => {
	it("should create a collection", () => {
		const collection = new Collection();

		expect(collection).toMatchInlineSnapshot(`
			Collection {
			  "data": [],
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			}
		`);
	});

	it("should push to the collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection).toMatchInlineSnapshot(`
			Collection {
			  "data": [
			    {
			      "resolve": [Function],
			    },
			  ],
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			}
		`);
	});

	it("should return the length of collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection.length).toBe(1);
	});

	it("should map the collection", () => {
		const repository = new InMemoryRepository<{ id: string }>();
		const collection = new Collection<{ id: string }>([], repository);

		collection.push({ id: "1" });

		const mapped = collection.map((data) => data.id);

		expect(mapped).toStrictEqual(["1"]);
	});

	it("should filter the collection", () => {
		const collection = new Collection<{ id: string }>();

		collection.push({ id: "1" });
		collection.push({ id: "2" });

		const filtered = collection.filter((data) => data.id === "1");

		expect(filtered).toBeInstanceOf(Slice);
		expect(filtered).toMatchInlineSnapshot(`
			Slice {
			  "collection": Collection {
			    "data": [
			      {
			        "resolve": [Function],
			      },
			      {
			        "resolve": [Function],
			      },
			    ],
			    "events": EventEmitter {
			      "events": Map {},
			    },
			    "repository": undefined,
			  },
			  "data": [],
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			}
		`);
	});
});
