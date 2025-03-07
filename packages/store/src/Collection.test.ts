import { InMemoryRepository } from "@nn/in-memory-repository";
import { describe, expect, it, vi } from "vitest";
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
			      "id": "1",
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
			        "id": "1",
			      },
			      {
			        "id": "2",
			      },
			    ],
			    "events": EventEmitter {
			      "events": Map {},
			    },
			    "repository": undefined,
			  },
			  "data": [
			    {
			      "id": "1",
			    },
			  ],
			  "events": EventEmitter {
			    "events": Map {},
			  },
			  "repository": undefined,
			}
		`);
	});

	it("should handle filtering an empty collection", () => {
		const collection = new Collection<{ id: string }>();
		const filtered = collection.filter(() => true);

		expect(filtered.length).toBe(0);
	});

	it("should emit events when the collection changes", () => {
		const collection = new Collection<{ id: string }>();
		const mockCallback = vi.fn();

		collection.events.on("update", mockCallback);
		collection.push({ id: "1" });

		expect(mockCallback).toHaveBeenCalled();
	});

	it("should work with the repository to retrieve items", () => {
		const repository = new InMemoryRepository<{ id: string }>();
		const collection = new Collection<{ id: string }>([], repository);

		collection.push({ id: "test" });

		expect(collection.map((item) => item.id)).toContainEqual("test");
	});
});
