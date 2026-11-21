import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { Time } from "@nn/time";
import { assert, describe, expect, it } from "vitest";

import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { ReconcileContext, Strategy } from "./strategy";

describe("MapStrategy", () => {
	const context: ReconcileContext = {
		inspect: () => undefined,
		fill: () => undefined,
		identify: () => undefined,
		resolve: (item) => item,
	};
	const strategy = new MapStrategy(
		new Map([
			["title", new RegisterStrategy("")],
			["count", new RegisterStrategy(0)],
		]),
	);

	describe("create", () => {
		it("creates a field entity for each declared field", () => {
			const entity = strategy.create({ title: "A", count: 1, extra: true }, "item");

			expect(entity.key).toBe("item");
			expect(entity.get("title")?.key).toBe("title");
			expect(entity.get("title")?.current).toBe("A");
			expect(entity.get("count")?.current).toBe(1);
			expect(entity.get("extra")).toBeUndefined();
		});

		it.each([undefined, "oops"])("creates default fields from %s", (value) => {
			const entity = strategy.create(value, "item");

			expect(entity.get("title")?.current).toBe("");
			expect(entity.get("count")?.current).toBe(0);
		});

		it("passes its timestamp to its fields", () => {
			const title = strategy.create(undefined, "item", Time.epoch()).get("title");

			LWWRegister.assert(title);

			expect(title.timestamp.toString()).toBe(Time.epoch().toString());
		});
	});

	describe("reconcile", () => {
		it("reconciles each declared field", () => {
			const entity = strategy.create({ title: "A", count: 1 }, "item");

			strategy.reconcile(entity, { title: "B", count: 1 }, context);

			expect(entity.get("title")?.current).toBe("B");
			expect(entity.get("count")?.current).toBe(1);
		});

		it("ignores a non-object value", () => {
			const entity = strategy.create({ title: "A" }, "item");
			const revision = entity.revision;

			strategy.reconcile(entity, "oops", context);

			expect(entity.revision).toBe(revision);
		});

		it("ignores an entity that is not a map", () => {
			const entity = new LWWRegister("A", "item");

			strategy.reconcile(entity, { title: "B" }, context);

			expect(entity.current).toBe("A");
		});
	});

	describe("conform", () => {
		it("fills a missing field with its zero value", () => {
			const entity = strategy.conform(new LWWMap({ title: new LWWRegister("A", "title", Time.now()) }, "item"));

			assert(LWWMap.is(entity));
			expect(entity.key).toBe("item");
			expect(entity.get("title")?.current).toBe("A");
			expect(entity.get("count")?.current).toBe(0);
		});

		it("keeps remote values", () => {
			const entity = strategy.conform(
				new LWWMap(
					{ title: new LWWRegister("A", "title", Time.now()), count: new LWWRegister(3, "count", Time.now()) },
					"item",
				),
			);

			assert(LWWMap.is(entity));
			expect(entity.get("count")?.current).toBe(3);
		});

		it("stamps filled fields at the epoch", () => {
			const entity = strategy.conform(new LWWMap({}, "item"));

			assert(LWWMap.is(entity));
			const count = entity.get("count");

			LWWRegister.assert(count);
			expect(count.timestamp.toString()).toBe(Time.epoch().toString());
		});

		it("drops fields the schema does not declare", () => {
			const entity = strategy.conform(new LWWMap({ extra: new LWWRegister(true, "extra", Time.now()) }, "item"));

			LWWMap.assert(entity);
			expect(entity.get("extra")).toBeUndefined();
		});

		it("completes nested items", () => {
			const nested = new MapStrategy(
				new Map<string, Strategy>([
					["title", new RegisterStrategy("")],
					["comments", new ListStrategy(new MapStrategy(new Map([["body", new RegisterStrategy("")]])))],
				]),
			);
			const entity = nested.conform(
				new LWWMap(
					{
						title: new LWWRegister("A", "title", Time.now()),
						comments: new RGA([new LWWMap({}, "c1")], "comments"),
					},
					"item",
				),
			);

			assert(LWWMap.is(entity));
			const comments = entity.get("comments");

			assert(RGA.is(comments));
			const comment = comments.get("c1");

			assert(LWWMap.is(comment));
			expect(comment.get("body")?.current).toBe("");
		});

		it("returns undefined for another kind", () => {
			expect(strategy.conform(new LWWRegister("A", "item", Time.now()))).toBeUndefined();
		});

		it("replaces a nested field of another kind", () => {
			const nested = new MapStrategy(
				new Map<string, Strategy>([
					["title", new RegisterStrategy("")],
					["comments", new ListStrategy(new MapStrategy(new Map([["body", new RegisterStrategy("")]])))],
				]),
			);
			const entity = nested.conform(
				new LWWMap(
					{
						title: new LWWRegister("A", "title", Time.now()),
						comments: new LWWRegister("none", "comments", Time.now()),
					},
					"item",
				),
			);

			LWWMap.assert(entity);
			const comments = entity.get("comments");

			RGA.assert(comments);
			expect(comments.size).toBe(0);
			expect(entity.get("title")?.current).toBe("A");
		});

		it("drops undeclared fields inside a nested object", () => {
			const withAssignee = new MapStrategy(
				new Map<string, Strategy>([["assignee", new MapStrategy(new Map([["name", new RegisterStrategy("")]]))]]),
			);
			const email = new LWWRegister("ann@example.com", "email", Time.now());
			const entity = withAssignee.conform(
				new LWWMap(
					{ assignee: new LWWMap({ name: new LWWRegister("Ann", "name", Time.now()), email }, "assignee") },
					"item",
				),
			);

			assert(LWWMap.is(entity));
			const assignee = entity.get("assignee");

			LWWMap.assert(assignee);
			expect(assignee.get("name")?.current).toBe("Ann");
			expect(assignee.get("email")).toBeUndefined();
		});

		it("replaces a declared field of another kind with an epoch default", () => {
			const entity = strategy.conform(new LWWMap({ count: new LWWMap({}, "count") }, "item"));

			assert(LWWMap.is(entity));
			const count = entity.get("count");

			LWWRegister.assert(count);
			expect(count.current).toBe(0);
			expect(count.timestamp.toString()).toBe(Time.epoch().toString());
		});

		it("looks up a declared field strategy", () => {
			expect(strategy.get("title")).toBeDefined();
			expect(strategy.get("missing")).toBeUndefined();
			expect(strategy.get("constructor")).toBeUndefined();
		});
	});
});
