import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";
import { RGA } from "./rga";

describe("RGA", () => {
	it("guards an RGA", () => {
		expect(RGA.is(new RGA([new LWWRegister("value")]))).toBeTruthy();
		expect(RGA.is(new LWWMap({}))).toBeFalsy();
		expect(RGA.is({ key: "key", current: [] })).toBeFalsy();
		expect(RGA.is(undefined)).toBeFalsy();
		expect(RGA.is(null)).toBeFalsy();
	});

	it("asserts an RGA", () => {
		expect(() => RGA.assert(new RGA([new LWWRegister("value")]))).not.toThrow();
		expect(() => RGA.assert(new LWWMap({}))).toThrow(new TypeError("Invalid RGA."));
		expect(() => RGA.assert({ key: "key", current: [] })).toThrow(TypeError);
		expect(() => RGA.assert(undefined)).toThrow(TypeError);
		expect(() => RGA.assert(null)).toThrow(TypeError);
	});

	it("accepts only an RGA when merging", () => {
		expectTypeOf<RGA<LWWRegister<string>>["merge"]>().parameters.toEqualTypeOf<[RGA<LWWRegister<string>>]>();
	});

	it("creates a rga", () => {
		const rga = new RGA();

		expect(rga.current).toHaveLength(0);
		expect(rga.current).toMatchInlineSnapshot(`[]`);
	});

	it("encodes its items in order", () => {
		const first = new LWWRegister("first", "a");
		const second = new LWWRegister("second", "b");
		const rga = new RGA([first, second], "items");

		expect(rga.encode()).toStrictEqual({
			key: "items",
			data: [first.encode(), second.encode()],
			metadata: { kind: "RGA", tombstones: [] },
		});
	});

	it("encodes removed keys", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "items");

		rga.remove("a");

		expect(rga.encode().metadata).toStrictEqual({ kind: "RGA", tombstones: ["a"] });
	});

	it("gets an item by key", () => {
		const item = new LWWMap({ title: new LWWRegister("first") });
		const rga = new RGA([item]);

		expect(rga.get(item.key)).toBe(item);
	});

	it("counts its items without removed ones", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);

		expect(rga.size).toBe(2);
		rga.remove("a");
		expect(rga.size).toBe(1);
	});

	it("lists its keys in order", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b"), new LWWRegister("3", "c")]);

		rga.remove("b");

		expect(Array.from(rga.keys())).toStrictEqual(["a", "c"]);
	});

	it("pushes to the rga", () => {
		const rga = new RGA<LWWMap<{ title: LWWRegister<string> }>>();
		const callback = vi.fn();

		rga.delegate = { entityDidChange: callback };
		rga.push(new LWWMap({ title: new LWWRegister("first") }));

		expect(rga.current).toHaveLength(1);
		expect(rga.current).toMatchInlineSnapshot(`
			[
			  {
			    "title": "first",
			  },
			]
		`);
		expect(callback).toHaveBeenCalledExactlyOnceWith(rga, undefined);
	});

	it("removes an item", () => {
		const rga = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
		const callback = vi.fn();

		rga.delegate = { entityDidChange: callback };

		expect(rga.current).toHaveLength(2);

		rga.remove("a");

		expect(rga.current).toHaveLength(1);
		expect(callback).toHaveBeenCalledExactlyOnceWith(rga, undefined);
	});

	it("skips removal of an unknown item", () => {
		const rga = new RGA([new LWWRegister("1", "a")]);
		const callback = vi.fn();

		rga.delegate = { entityDidChange: callback };
		rga.remove("b");

		expect(rga.current).toHaveLength(1);
		expect(callback).toHaveBeenCalledTimes(0);
	});

	it("replaces the contents", () => {
		const rga = new RGA([new LWWRegister("1")]);
		const items = [new LWWRegister("2"), new LWWRegister("3")];
		const callback = vi.fn();

		rga.delegate = { entityDidChange: callback };

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
		expect(callback).toHaveBeenCalledExactlyOnceWith(rga, undefined);
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

		rga.delegate = { entityDidChange: callback };
		item.current = "2";

		expect(callback).toHaveBeenCalledExactlyOnceWith(rga, item);
	});

	it("stops observing a removed item", () => {
		const item = new LWWRegister("1", "a");
		const rga = new RGA([item]);
		const callback = vi.fn();

		rga.remove("a");
		rga.delegate = { entityDidChange: callback };
		item.current = "2";

		expect(item.delegate).toBeUndefined();
		expect(callback).not.toHaveBeenCalled();
	});

	describe("tombstones", () => {
		it("keeps a removed item removed when a replica that still holds it merges", () => {
			const local = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);

			local.remove("a");
			local.merge(remote);

			expect(local.get("a")).toBeUndefined();
			expect(local.current.map((item) => item.key)).toStrictEqual(["b"]);
		});

		it("removes an item locally when the remote removed it", () => {
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const local = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const callback = vi.fn();

			remote.remove("a");
			local.delegate = { entityDidChange: callback };
			local.merge(remote);

			expect(local.current.map((item) => item.key)).toStrictEqual(["b"]);
			expect(callback).toHaveBeenCalledExactlyOnceWith(local, undefined);
		});

		it("converges whichever order replicas merge in", () => {
			const build = () => new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b"), new LWWRegister("3", "c")]);
			const left = build();
			const right = build();

			left.remove("a");
			right.remove("c");
			left.merge(right);
			right.merge(left);

			expect(left.current.map((item) => item.key)).toStrictEqual(["b"]);
			expect(right.current.map((item) => item.key)).toStrictEqual(["b"]);
		});

		it("is idempotent", () => {
			const local = new RGA([new LWWRegister("1", "a")]);
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const callback = vi.fn();

			remote.remove("a");
			local.merge(remote);
			local.delegate = { entityDidChange: callback };
			local.merge(remote);

			expect(local.current.map((item) => item.key)).toStrictEqual(["b"]);
			expect(callback).not.toHaveBeenCalled();
		});

		it("lets a removal win over a concurrent edit", () => {
			const item = new LWWRegister("1", "a");
			const local = new RGA([item]);
			const remote = new RGA([new LWWRegister("1", "a")]);

			remote.remove("a");
			item.current = "edited";
			local.merge(remote);

			expect(local.get("a")).toBeUndefined();
		});

		it("ignores an item whose removal arrived first", () => {
			const local = new RGA<LWWRegister<string>>();
			const deleted = new RGA([new LWWRegister("1", "a")]);
			const stale = new RGA([new LWWRegister("1", "a")]);

			deleted.remove("a");
			local.merge(deleted);
			local.merge(stale);

			expect(local.get("a")).toBeUndefined();
			expect(local.current).toHaveLength(0);
		});

		it("notifies when only tombstones grow", () => {
			const local = new RGA([new LWWRegister("2", "b")]);
			const remote = new RGA([new LWWRegister("1", "a")]);
			const callback = vi.fn();

			remote.remove("a");
			local.delegate = { entityDidChange: callback };
			local.merge(remote);

			expect(local.current.map((item) => item.key)).toStrictEqual(["b"]);
			expect(callback).toHaveBeenCalledExactlyOnceWith(local, undefined);
		});

		it("detaches an item removed by a merge", () => {
			const item = new LWWRegister("1", "a");
			const local = new RGA([item]);
			const remote = new RGA([new LWWRegister("1", "a")]);
			const callback = vi.fn();

			remote.remove("a");
			local.merge(remote);
			local.delegate = { entityDidChange: callback };
			item.current = "2";

			expect(item.delegate).toBeUndefined();
			expect(callback).not.toHaveBeenCalled();
		});

		it("ignores a push of a removed key", () => {
			const local = new RGA([new LWWRegister("1", "a")]);
			const callback = vi.fn();
			const again = new LWWRegister("2", "a");

			local.remove("a");
			local.delegate = { entityDidChange: callback };
			local.push(again);

			expect(local.get("a")).toBeUndefined();
			expect(again.delegate).toBeUndefined();
			expect(callback).not.toHaveBeenCalled();
		});

		it("does not tombstone an unknown key", () => {
			const local = new RGA<LWWRegister<string>>();

			local.remove("a");
			local.push(new LWWRegister("1", "a"));

			expect(local.get("a")).toBeDefined();
		});

		it("tombstones items dropped by assigning current", () => {
			const local = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);

			local.current = [new LWWRegister("2", "b"), new LWWRegister("3", "c")];
			local.merge(remote);

			expect(local.current.map((item) => item.key)).toStrictEqual(["b", "c"]);
		});

		it("skips removed keys when constructed", () => {
			const local = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "list", ["a"]);

			expect(local.current.map((item) => item.key)).toStrictEqual(["b"]);
		});
	});

	describe("iteration", () => {
		const setupList = () =>
			new RGA([new LWWRegister("a", "a"), new LWWRegister("b", "b"), new LWWRegister("c", "c")], "list", ["x"]);

		it("spreads into an array", () => {
			const list = setupList();

			expect([...list]).toStrictEqual(list.current);
		});

		it("skips tombstoned items", () => {
			const list = new RGA([new LWWRegister("x", "x"), new LWWRegister("b", "b")], "list", ["x"]);

			expect([...list].map((item) => item.key)).toStrictEqual(["b"]);
		});

		it("iterates a snapshot when the list changes during iteration", () => {
			const list = setupList();
			const visited: string[] = [];

			for (const item of list) {
				visited.push(item.key);

				if (item.key === "a") {
					list.remove("b");
					list.push(new LWWRegister("d", "d"));
				}
			}

			expect(visited).toStrictEqual(["a", "b", "c"]);
		});
	});

	describe("tombstones view", () => {
		it("lists the removed keys", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "list", ["x"]);

			list.remove("a");

			expect([...list.tombstones]).toStrictEqual(["x", "a"]);
		});

		it("stays live across removal, merge and assignment", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b"), new LWWRegister("3", "c")], "list");
			const view = list.tombstones;

			list.remove("a");
			list.merge(new RGA([], "list", ["b"]));
			list.current = [];

			expect([...view]).toStrictEqual(["a", "b", "c"]);
		});
	});

	describe("merge", () => {
		it("notifies when an empty rga receives merged items", () => {
			const local = new RGA<LWWRegister<string>>();
			const item = new LWWRegister("1", "a");
			const callback = vi.fn();

			local.delegate = { entityDidChange: callback };
			expect(local.merge(new RGA([item]))).toBe(local);

			expect(local.get("a")).toBe(item);
			expect(local.revision).toBe(1);
			expect(callback).toHaveBeenCalledExactlyOnceWith(local, undefined);
		});

		it("does not notify when the remote rga is a subset", () => {
			const first = new LWWRegister("1", "a");
			const local = new RGA([first, new LWWRegister("2", "b")]);
			const callback = vi.fn();

			local.delegate = { entityDidChange: callback };
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

		it("keeps both replicas' edits when each changed a different field of the same item", () => {
			let time = 1000;

			vi.spyOn(Date, "now").mockImplementation(() => time);

			const title = new LWWRegister("Title", "title");
			const note = new LWWRegister("Note", "note");

			const remoteTitle = new LWWRegister("Title", "title");
			const remoteNote = new LWWRegister("Note", "note");

			const local = new RGA([new LWWMap({ title, note }, "item-1")], "tickets");

			const remote = new RGA([new LWWMap({ title: remoteTitle, note: remoteNote }, "item-1")], "tickets");

			time = 2000;
			remoteNote.current = "Remote note";

			time = 3000;
			title.current = "Local title";

			local.merge(remote);

			expect(title.current).toBe("Local title");
			expect(note.current).toBe("Remote note");
			expect(local.current).toHaveLength(1);
		});

		it("appends unseen items and emits once", () => {
			const local = new RGA([new LWWRegister("1", "a")]);
			const callback = vi.fn();

			local.delegate = { entityDidChange: callback };
			local.merge(new RGA([new LWWRegister("2", "b"), new LWWRegister("3", "c")]));

			expect(local.current).toMatchInlineSnapshot(`
				[
				  "1",
				  "2",
				  "3",
				]
			`);
			expect(callback).toHaveBeenCalledExactlyOnceWith(local, undefined);
		});

		it("adopts items added by a merge", () => {
			const item = new LWWRegister("1", "a");
			const incoming = new RGA([item]);
			const local = new RGA<LWWRegister<string>>();
			const delegate = { entityDidChange: vi.fn() };

			local.merge(incoming);
			local.delegate = delegate;
			item.current = "2";

			expect(local.get("a")).toBe(item);
			expect(item.delegate).toBe(local);
			expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(local, item);
		});

		it("does not adopt an incoming item whose key already exists", () => {
			const existing = new LWWRegister("1", "a");
			const incoming = new LWWRegister("2", "a");
			const local = new RGA([existing]);
			const remote = new RGA([incoming]);

			local.merge(remote);

			expect(local.get("a")).toBe(existing);
			expect(incoming.delegate).toBe(remote);
		});

		it("keeps local-only items and their order when incoming items are reordered", () => {
			const first = new LWWRegister("first", "a");
			const kept = new LWWRegister("kept", "b");
			const local = new RGA([first, kept]);

			local.merge(new RGA([new LWWRegister("added", "c"), new LWWRegister("updated", "a")]));

			expect(local.current.map((item) => item.current)).toStrictEqual(["updated", "kept", "added"]);
			expect(local.get("a")).toBe(first);
			expect(local.get("b")).toBe(kept);
		});

		it("does not notify when incoming items are empty or stale", () => {
			const older = new LWWRegister("old", "a");
			const local = new RGA([new LWWRegister("local", "a")]);
			const callback = vi.fn();

			local.delegate = { entityDidChange: callback };

			local.merge(new RGA<LWWRegister<string>>());
			local.merge(new RGA([older]));
			expect(local.current.map((item) => item.current)).toStrictEqual(["local"]);
			expect(local.revision).toBe(0);
			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe("current", () => {
		const keys = (list: RGA<LWWRegister<string>>) => list.current.map((item) => item.key);

		it("returns the same rows until membership changes", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);

			expect(list.current).toBe(list.current);
		});

		it("returns new rows after a push, removal or replacement", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			let previous = list.current;

			list.push(new LWWRegister("3", "c"));
			expect(list.current).not.toBe(previous);
			expect(keys(list)).toStrictEqual(["a", "b", "c"]);

			previous = list.current;
			list.remove("a");
			expect(list.current).not.toBe(previous);
			expect(keys(list)).toStrictEqual(["b", "c"]);

			previous = list.current;
			list.current = [new LWWRegister("4", "d")];
			expect(list.current).not.toBe(previous);
			expect(keys(list)).toStrictEqual(["d"]);
		});

		it("returns no rows after assigning an empty list", () => {
			const list = new RGA([new LWWRegister("1", "a")]);
			const previous = list.current;

			list.current = [];

			expect(list.current).not.toBe(previous);
			expect(list.current).toStrictEqual([]);
		});

		it("returns new rows after a merge that adds or removes", () => {
			const local = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")]);
			const remote = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b"), new LWWRegister("3", "c")]);
			const previous = local.current;

			remote.remove("a");
			local.merge(remote);

			expect(local.current).not.toBe(previous);
			expect(keys(local)).toStrictEqual(["b", "c"]);
		});

		it("keeps its rows when an item changes", () => {
			const list = new RGA([new LWWRegister("1", "a")]);
			const rows = list.current;
			const [first] = rows;

			LWWRegister.assert(first);
			first.current = "changed";

			expect(list.current).toBe(rows);
		});
	});

	describe("rebuilding from tombstones", () => {
		it("keeps the removed items of the source list", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "list");
			const replica = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "list");

			list.remove("a");
			replica.merge(
				new RGA(
					list.current.map((item) => new LWWRegister(item.current, item.key)),
					list.key,
					list.tombstones,
				),
			);

			expect(replica.current.map((item) => item.key)).toStrictEqual(["b"]);
		});

		it("does not share tombstones with the source list", () => {
			const list = new RGA([new LWWRegister("1", "a"), new LWWRegister("2", "b")], "list", ["x"]);
			const rebuilt = new RGA(
				list.current.map((item) => new LWWRegister(item.current, item.key)),
				list.key,
				list.tombstones,
			);

			rebuilt.remove("a");
			list.remove("b");

			expect([...list.tombstones]).toStrictEqual(["x", "b"]);
			expect([...rebuilt.tombstones]).toStrictEqual(["x", "a"]);
		});
	});
});
