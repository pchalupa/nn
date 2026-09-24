import { describe, expect, it, vi } from "vitest";

import { Collection, Slice } from "./Collection";

describe("Collection", () => {
	it("should create a collection", () => {
		const collection = new Collection();

		expect(collection).toMatchInlineSnapshot(`[]`);
	});

	it("should push to the collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection).toMatchInlineSnapshot(`
			[
			  {
			    "id": "1",
			  },
			]
		`);
	});

	it("should serialize collection", () => {
		const collection = new Collection([{ id: "1" }, { id: "2" }]);

		expect(JSON.stringify(collection)).toMatchInlineSnapshot(`"[{"id":"1"},{"id":"2"}]"`);
	});

	it("should serialize slice", () => {
		const collection = new Collection([{ id: "1" }, { id: "2" }]);

		expect(JSON.stringify(collection.filter((data) => data.id === "2"))).toMatchInlineSnapshot(`"[{"id":"2"}]"`);
	});

	it("should return the length of collection", () => {
		const collection = new Collection();

		collection.push({ id: "1" });

		expect(collection.length).toBe(1);
	});

	it("should map the collection", () => {
		const collection = new Collection<{ id: string }>([]);

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
			[
			  {
			    "id": "1",
			  },
			]
		`);
	});

	it("should push through a slice to the collection", () => {
		const collection = new Collection<{ id: string }>();

		collection.push({ id: "1" });

		const slice = collection.filter((data) => data.id === "1");

		slice.push({ id: "2" });

		expect(slice.map((item) => item.id)).toStrictEqual(["1", "2"]);
		expect(collection.map((item) => item.id)).toStrictEqual(["1", "2"]);
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
		const collection = new Collection<{ id: string }>([]);

		collection.push({ id: "test" });

		expect(collection.map((item) => item.id)).toContainEqual("test");
	});
});
