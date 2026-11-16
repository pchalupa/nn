import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { Time } from "@nn/time";
import { assert, describe, expect, it } from "vitest";

import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { ReconcileContext } from "./strategy";

describe("ListStrategy", () => {
	const entities = new WeakMap<object, Entity>();
	const context: ReconcileContext = {
		inspect: () => undefined,
		fill: () => undefined,
		identify: (value) => entities.get(value),
	};
	const tags = new ListStrategy(new RegisterStrategy(""));
	const items = new ListStrategy(new MapStrategy(new Map([["title", new RegisterStrategy("")]])));

	describe("create", () => {
		it("creates an item entity for each value", () => {
			const list = tags.create(["x", "y"], "tags");

			expect(list.current.map((item) => item.current)).toStrictEqual(["x", "y"]);
		});

		it("creates an empty list from a non-array value", () => {
			expect(tags.create("oops", "tags").current).toStrictEqual([]);
		});

		it("creates default items for holes in a sparse list", () => {
			const value = ["x"];

			value[2] = "z";

			expect(tags.create(value, "tags").current.map((item) => item.current)).toStrictEqual(["x", "", "z"]);
		});

		it("detaches the entity from the supplied data", () => {
			const value = ["x"];
			const list = tags.create(value, "tags");

			value.push("y");

			expect(list.current.map((item) => item.current)).toStrictEqual(["x"]);
		});

		it("assigns item keys independently of a declared key field", () => {
			const strategy = new ListStrategy(new MapStrategy(new Map([["key", new RegisterStrategy("")]])));

			expect(strategy.create([{ key: "c1" }], "items").current[0]?.key).not.toBe("c1");
		});
	});

	describe("reconcile", () => {
		it("matches primitive items by index", () => {
			const list = tags.create(["x", "y"], "tags");
			const [first] = list.current;

			tags.reconcile(list, ["x", "z", "w"], context);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x", "z", "w"]);
			expect(list.current[0]).toBe(first);

			tags.reconcile(list, ["x"], context);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x"]);
		});

		it("treats holes in a sparse list as missing values", () => {
			const list = tags.create(["x"], "tags");
			const value = ["x"];

			value[2] = "z";
			tags.reconcile(list, value, context);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x", "", "z"]);
		});

		it("matches object items by identity", () => {
			const list = items.create([{ title: "A" }], "items");
			const [item] = list.current;
			const draft = { title: "B" };

			assert(item);
			entities.set(draft, item);
			items.reconcile(list, [draft, { title: "C" }], context);

			expect(list.current[0]).toBe(item);
			expect(list.current[1]?.key).not.toBe(item.key);
			expect(list.current).toMatchObject([
				{ current: { title: { current: "B" } } },
				{ current: { title: { current: "C" } } },
			]);
		});

		it("gives an item from another list a new identity", () => {
			const source = items.create([{ title: "A" }], "source");
			const target = items.create([], "target");
			const [item] = source.current;
			const draft = { title: "A" };

			assert(item);
			entities.set(draft, item);
			items.reconcile(target, [draft], context);

			expect(target.current[0]?.key).not.toBe(item.key);
			expect(source.current).toStrictEqual([item]);
		});

		it("gives an object tagged with another entity under the same key a new identity", () => {
			const list = items.create([{ title: "A" }], "items");
			const [item] = list.current;

			assert(item);

			const foreign = new LWWMap({ title: new LWWRegister("A", "title") }, item.key);
			const value = { title: "B" };

			entities.set(value, foreign);
			items.reconcile(list, [value], context);

			expect(list.current[0]?.key).not.toBe(item.key);
			expect(foreign.get("title")?.current).toBe("A");
		});

		it("gives a frozen untagged object a new identity", () => {
			const list = items.create([{ title: "A" }], "items");
			const [item] = list.current;

			items.reconcile(list, [Object.freeze({ title: "A" })], context);

			expect(list.current[0]?.key).not.toBe(item?.key);
		});

		it("keeps item order on a reorder-only draft", () => {
			const list = items.create([{ title: "A" }, { title: "B" }], "items");
			const [first, second] = list.current;
			const a = { title: "A" };
			const b = { title: "B" };

			assert(first && second);
			entities.set(a, first);
			entities.set(b, second);

			const revision = list.revision;

			items.reconcile(list, [b, a], context);

			expect(list.current).toStrictEqual([first, second]);
			expect(list.revision).toBe(revision);
		});

		it("ignores a non-array value", () => {
			const list = tags.create(["x"], "tags");
			const revision = list.revision;

			tags.reconcile(list, "oops", context);

			expect(list.revision).toBe(revision);
		});
	});

	describe("conform", () => {
		it("completes every item and keeps keys", () => {
			const list = items.conform(new RGA([new LWWMap({}, "r1"), new LWWMap({}, "r2")], "list"));

			assert(RGA.is(list));
			expect(list.key).toBe("list");
			expect(list.current.map((item) => item.key)).toStrictEqual(["r1", "r2"]);
			expect(list.current.map((item) => (LWWMap.is(item) ? item.get("title")?.current : undefined))).toStrictEqual([
				"",
				"",
			]);
		});

		it("keeps the removed items of the remote list", () => {
			const local = new RGA<Entity>([new LWWMap({}, "r1"), new LWWMap({}, "r2")], "list");
			const remote = items.conform(new RGA([new LWWMap({}, "r2")], "list", ["r1"]));

			assert(RGA.is(remote));
			local.merge(remote);

			expect(local.current.map((item) => item.key)).toStrictEqual(["r2"]);
		});

		it("returns an entity of another kind unchanged", () => {
			const register = new LWWRegister("A", "list", Time.now());

			expect(items.conform(register)).toBe(register);
		});
	});
});
