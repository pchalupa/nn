import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { Time } from "@nn/time";
import { assert, describe, expect, it } from "vitest";

import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";

describe("ListStrategy", () => {
	const entities = new WeakMap<object, Entity>();
	const tags = new ListStrategy(new RegisterStrategy(""), entities);
	const rows = new ListStrategy(new MapStrategy(new Map([["title", new RegisterStrategy("")]])), entities);

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
			const strategy = new ListStrategy(new MapStrategy(new Map([["key", new RegisterStrategy("")]])), entities);

			expect(strategy.create([{ key: "c1" }], "rows").current[0]?.key).not.toBe("c1");
		});
	});

	describe("reconcile", () => {
		it("matches primitive items by index", () => {
			const list = tags.create(["x", "y"], "tags");
			const [first] = list.current;

			tags.reconcile(list, ["x", "z", "w"]);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x", "z", "w"]);
			expect(list.current[0]).toBe(first);

			tags.reconcile(list, ["x"]);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x"]);
		});

		it("treats holes in a sparse list as missing values", () => {
			const list = tags.create(["x"], "tags");
			const value = ["x"];

			value[2] = "z";
			tags.reconcile(list, value);

			expect(list.current.map((item) => item.current)).toStrictEqual(["x", "", "z"]);
		});

		it("matches object rows by identity", () => {
			const list = rows.create([{ title: "A" }], "rows");
			const [row] = list.current;
			const draft = { title: "B" };

			assert(row);
			entities.set(draft, row);
			rows.reconcile(list, [draft, { title: "C" }]);

			expect(list.current[0]).toBe(row);
			expect(list.current[1]?.key).not.toBe(row.key);
			expect(list.current).toMatchObject([
				{ current: { title: { current: "B" } } },
				{ current: { title: { current: "C" } } },
			]);
		});

		it("gives a row from another list a new identity", () => {
			const source = rows.create([{ title: "A" }], "source");
			const target = rows.create([], "target");
			const [row] = source.current;
			const draft = { title: "A" };

			assert(row);
			entities.set(draft, row);
			rows.reconcile(target, [draft]);

			expect(target.current[0]?.key).not.toBe(row.key);
			expect(source.current).toStrictEqual([row]);
		});

		it("keeps row order on a reorder-only draft", () => {
			const list = rows.create([{ title: "A" }, { title: "B" }], "rows");
			const [first, second] = list.current;
			const a = { title: "A" };
			const b = { title: "B" };

			assert(first && second);
			entities.set(a, first);
			entities.set(b, second);

			const revision = list.revision;

			rows.reconcile(list, [b, a]);

			expect(list.current).toStrictEqual([first, second]);
			expect(list.revision).toBe(revision);
		});

		it("ignores a non-array value", () => {
			const list = tags.create(["x"], "tags");
			const revision = list.revision;

			tags.reconcile(list, "oops");

			expect(list.revision).toBe(revision);
		});
	});

	describe("conform", () => {
		it("completes every row and keeps keys", () => {
			const list = rows.conform(new RGA([new LWWMap({}, "r1"), new LWWMap({}, "r2")], "list"));

			assert(RGA.is(list));
			expect(list.key).toBe("list");
			expect(list.current.map((row) => row.key)).toStrictEqual(["r1", "r2"]);
			expect(list.current.map((row) => (row instanceof LWWMap ? row.get("title")?.current : undefined))).toStrictEqual([
				"",
				"",
			]);
		});

		it("returns an entity of another kind unchanged", () => {
			const register = new LWWRegister("A", "list", Time.now());

			expect(rows.conform(register)).toBe(register);
		});
	});
});
