import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { Time } from "@nn/time";
import { describe, expect, it } from "vitest";

import { MapStrategy } from "./MapStrategy";
import { RegisterStrategy } from "./RegisterStrategy";

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
});
