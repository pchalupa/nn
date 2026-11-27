import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";
import { Time } from "@goodstate/time";
import { assert, describe, expect, it } from "vitest";

import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { ReconcileContext } from "./strategy";

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

		it("drops fields the schema does not declare", () => {
			const entity = strategy.conform(new LWWMap({ extra: new LWWRegister(true, "extra", Time.now()) }, "item"));

			LWWMap.assert(entity);
			expect(entity.get("extra")).toBeUndefined();
		});

		it("returns undefined for another kind", () => {
			expect(strategy.conform(new LWWRegister("A", "item", Time.now()))).toBeUndefined();
		});

		it("replaces a declared field of another kind with an epoch default", () => {
			const entity = strategy.conform(new LWWMap({ count: new LWWMap({}, "count") }, "item"));

			assert(LWWMap.is(entity));
			const count = entity.get("count");

			LWWRegister.assert(count);
			expect(count.current).toBe(0);
			expect(count.timestamp.toString()).toBe(Time.epoch().toString());
		});
	});
});
