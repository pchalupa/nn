import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";
import { RGA } from "./RGA";

describe("RGA", () => {
	it("accepts only an RGA when merging", () => {
		expectTypeOf<RGA<LWWRegister<string>>["merge"]>().parameters.toEqualTypeOf<[RGA<LWWRegister<string>>]>();
	});

	it("creates a rga", () => {
		const rga = new RGA();

		expect(rga.current).toHaveLength(0);
		expect(rga.current).toMatchInlineSnapshot(`[]`);
	});

	it("finds an item by key", () => {
		const item = new LWWMap({ title: new LWWRegister("first") });
		const rga = new RGA([item]);

		expect(rga.find(item.key)).toBe(item);
	});

	it("pushes to the rga", () => {
		const rga = new RGA<LWWMap<{ title: LWWRegister<string> }>>();
		const callback = vi.fn();

		rga.subscribe(callback);
		rga.push(new LWWMap({ title: new LWWRegister("first") }));

		expect(rga.current).toHaveLength(1);
		expect(rga.current).toMatchInlineSnapshot(`
			[
			  {
			    "title": "first",
			  },
			]
		`);
		expect(callback).toHaveBeenCalledExactlyOnceWith();
	});

	it("removes an item", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
		const callback = vi.fn();

		rga.subscribe(callback);

		expect(rga.current).toHaveLength(2);

		rga.remove("a");

		expect(rga.current).toHaveLength(1);
		expect(callback).toHaveBeenCalledExactlyOnceWith();
	});

	it("skips removal of an unknown item", () => {
		const rga = new RGA([new LWWRegister("1", "a")]);
		const callback = vi.fn();

		rga.subscribe(callback);
		rga.remove("b");

		expect(rga.current).toHaveLength(1);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it("replaces the contents", () => {
		const rga = new RGA([new LWWRegister("1")]);
		const items = [new LWWRegister("2"), new LWWRegister("3")];
		const callback = vi.fn();

		rga.subscribe(callback);

		expect(rga.current).toMatchInlineSnapshot(`
			[
			  "1",
			]
		`);

		rga.current = items;

		expect(rga.current).toMatchInlineSnapshot(`
			[
			  "2",
			  "3",
			]
		`);
		expect(callback).toHaveBeenCalledExactlyOnceWith();
	});

	it("keeps the order items were added in", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b"), new LWWRegister("3", "c")]);

		rga.remove("b");
		rga.push(new LWWRegister("4", "d"));
		rga.push(new LWWRegister("5", "e"));

		expect(rga.current[0].key).toBe("a");
		expect(rga.current[1].key).toBe("c");
		expect(rga.current[2].key).toBe("d");
		expect(rga.current[3].key).toBe("e");
		expect(rga.current).toHaveLength(4);
	});

	it("emits an update when an item changes", () => {
		const item = new LWWRegister("1");
		const rga = new RGA([item]);
		const callback = vi.fn();

		rga.subscribe(callback);
		item.current = "2";

		expect(callback).toHaveBeenCalledExactlyOnceWith();
	});

	it("stops observing a removed item", () => {
		const item = new LWWRegister("1", "a");
		const rga = new RGA([item]);
		const callback = vi.fn();

		rga.remove("a");
		rga.subscribe(callback);
		item.current = "2";

		expect(callback).not.toHaveBeenCalledOnce();
	});

	describe("merge", () => {
		it("notifies when an empty rga receives merged items", () => {
			const local = new RGA<LWWRegister<string>>();
			const item = new LWWRegister("1", "a");
			const callback = vi.fn();

			local.subscribe(callback);
			expect(local.merge(new RGA([item]))).toBe(local);

			expect(local.find("a")).toBe(item);
			expect(local.revision).toBe(1);
			expect(callback).toHaveBeenCalledExactlyOnceWith();
		});

		it("does not notify when the remote rga is a subset", () => {
			const first = new LWWRegister("1", "a");
			const local = new RGA([first, new LWWRegister("2", "b")]);
			const callback = vi.fn();

			local.subscribe(callback);
			local.merge(new RGA([first]));

			expect(local).toMatchInlineSnapshot(`
				[
				  "1",
				  "2",
				]
			`);
			expect(local.revision).toBe(0);
			expect(callback).not.toHaveBeenCalled();
		});

		it("merges a remote item into the item that carries the same key", () => {
			const local = new RGA([new LWWRegister("0", "a")]);
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);

			local.merge(remote);

			expect(local.current).toMatchInlineSnapshot(`
				[
				  "1",
				  "2",
				]
			`);
		});

		it("appends unseen items and emits once", () => {
			const local = new RGA([new LWWRegister("1", "a")]);
			const callback = vi.fn();

			local.subscribe(callback);
			local.merge(new RGA([new LWWRegister("2", "b"), new LWWRegister("3", "c")]));

			expect(local.current).toMatchInlineSnapshot(`
				[
				  "1",
				  "2",
				  "3",
				]
			`);
			expect(callback).toHaveBeenCalledExactlyOnceWith();
		});

		it("observes items added by a merge", () => {
			const item = new LWWRegister("1", "a");
			const local = new RGA<LWWRegister<string>>();
			const callback = vi.fn();

			local.merge(new RGA([item]));
			local.subscribe(callback);
			item.current = "2";

			expect(local.find("a")).toBe(item);
			expect(callback).toHaveBeenCalledExactlyOnceWith();
		});

		it("keeps local-only rows and their order when incoming rows are reordered", () => {
			const first = new LWWRegister("first", "a");
			const kept = new LWWRegister("kept", "b");
			const local = new RGA([first, kept]);
			local.merge(new RGA([new LWWRegister("added", "c"), new LWWRegister("updated", "a")]));

			expect(local.current.map((row) => row.current)).toStrictEqual(["updated", "kept", "added"]);
			expect(local.find("a")).toBe(first);
			expect(local.find("b")).toBe(kept);
		});

		it("does not notify when incoming rows are empty or stale", () => {
			const older = new LWWRegister("old", "a");
			const local = new RGA([new LWWRegister("local", "a")]);
			const callback = vi.fn();
			local.subscribe(callback);

			local.merge(new RGA<LWWRegister<string>>());
			local.merge(new RGA([older]));
			expect(local.current.map((row) => row.current)).toStrictEqual(["local"]);
			expect(local.revision).toBe(0);
			expect(callback).not.toHaveBeenCalled();
		});
	});
});
