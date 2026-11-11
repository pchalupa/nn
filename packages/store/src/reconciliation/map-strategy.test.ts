import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { Time } from "@nn/time";
import { assert, describe, expect, it } from "vitest";

import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { Strategy } from "./strategy";

describe("MapStrategy", () => {
	const strategy = new MapStrategy(
		new Map([
			["title", new RegisterStrategy("")],
			["count", new RegisterStrategy(0)],
		]),
	);

	describe("create", () => {
		it("creates a field entity for each declared field", () => {
			const entity = strategy.create({ title: "A", count: 1, extra: true }, "row");

			expect(entity.key).toBe("row");
			expect(entity.get("title")?.key).toBe("title");
			expect(entity.get("title")?.current).toBe("A");
			expect(entity.get("count")?.current).toBe(1);
			expect(entity.get("extra")).toBeUndefined();
		});

		it.each([undefined, "oops"])("creates default fields from %s", (value) => {
			const entity = strategy.create(value, "row");

			expect(entity.get("title")?.current).toBe("");
			expect(entity.get("count")?.current).toBe(0);
		});

		it("passes its timestamp to its fields", () => {
			const title = strategy.create(undefined, "row", Time.epoch()).get("title");

			expect(title instanceof LWWRegister ? title.timestamp.toString() : undefined).toBe(Time.epoch().toString());
		});
	});

	describe("reconcile", () => {
		it("reconciles each declared field", () => {
			const entity = strategy.create({ title: "A", count: 1 }, "row");

			strategy.reconcile(entity, { title: "B", count: 1 });

			expect(entity.get("title")?.current).toBe("B");
			expect(entity.get("count")?.current).toBe(1);
		});

		it("ignores a non-object value", () => {
			const entity = strategy.create({ title: "A" }, "row");
			const revision = entity.revision;

			strategy.reconcile(entity, "oops");

			expect(entity.revision).toBe(revision);
		});

		it("ignores an entity that is not a map", () => {
			const entity = new LWWRegister("A", "row");

			strategy.reconcile(entity, { title: "B" });

			expect(entity.current).toBe("A");
		});
	});

	describe("conform", () => {
		it("fills a missing field with its zero value", () => {
			const entity = strategy.conform(new LWWMap({ title: new LWWRegister("A", "title", Time.now()) }, "row"));

			assert(LWWMap.is(entity));
			expect(entity.key).toBe("row");
			expect(entity.get("title")?.current).toBe("A");
			expect(entity.get("count")?.current).toBe(0);
		});

		it("keeps remote values", () => {
			const entity = strategy.conform(
				new LWWMap(
					{ title: new LWWRegister("A", "title", Time.now()), count: new LWWRegister(3, "count", Time.now()) },
					"row",
				),
			);

			assert(LWWMap.is(entity));
			expect(entity.get("count")?.current).toBe(3);
		});

		it("stamps filled fields at the epoch", () => {
			const entity = strategy.conform(new LWWMap({}, "row"));

			assert(LWWMap.is(entity));
			const count = entity.get("count");

			assert(count instanceof LWWRegister);
			expect(count.timestamp.toString()).toBe(Time.epoch().toString());
		});

		it("carries over fields the schema does not declare", () => {
			const extra = new LWWRegister(true, "extra", Time.now());
			const entity = strategy.conform(new LWWMap({ extra }, "row"));

			assert(entity instanceof LWWMap);
			expect(entity.get("extra")).toBe(extra);
		});

		it("completes nested rows", () => {
			const nested = new MapStrategy(
				new Map<string, Strategy>([
					["title", new RegisterStrategy("")],
					["comments", new ListStrategy(new MapStrategy(new Map([["body", new RegisterStrategy("")]])), new WeakMap())],
				]),
			);
			const entity = nested.conform(
				new LWWMap(
					{
						title: new LWWRegister("A", "title", Time.now()),
						comments: new RGA([new LWWMap({}, "c1")], "comments"),
					},
					"row",
				),
			);

			assert(LWWMap.is(entity));
			const comments = entity.get("comments");

			assert(RGA.is(comments));
			const comment = comments.find("c1");

			assert(LWWMap.is(entity));
			expect(comment.get("body")?.current).toBe("");
		});

		it("returns an entity of another kind unchanged", () => {
			const register = new LWWRegister("A", "row", Time.now());

			expect(strategy.conform(register)).toBe(register);
		});

		it("carries over undeclared fields inside a nested object", () => {
			const withAssignee = new MapStrategy(
				new Map<string, Strategy>([["assignee", new MapStrategy(new Map([["name", new RegisterStrategy("")]]))]]),
			);
			const email = new LWWRegister("ann@example.com", "email", Time.now());
			const entity = withAssignee.conform(
				new LWWMap(
					{ assignee: new LWWMap({ name: new LWWRegister("Ann", "name", Time.now()), email }, "assignee") },
					"row",
				),
			);

			assert(LWWMap.is(entity));
			const assignee = entity.get("assignee");

			assert(assignee instanceof LWWMap);
			expect(assignee.get("name")?.current).toBe("Ann");
			expect(assignee.get("email")).toBe(email);
		});

		it("carries over a declared field of another kind unchanged", () => {
			const count = new LWWMap({}, "count");
			const entity = strategy.conform(new LWWMap({ count }, "row"));

			assert(LWWMap.is(entity));
			expect(entity.get("count")).toBe(count);
		});

		it("looks up a declared field strategy", () => {
			expect(strategy.get("title")).toBeDefined();
			expect(strategy.get("missing")).toBeUndefined();
			expect(strategy.get("constructor")).toBeUndefined();
		});
	});
});
