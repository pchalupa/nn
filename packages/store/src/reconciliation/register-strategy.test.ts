import { LWWMap } from "@nn/entities/kinds/lww-map";
import { Time } from "@nn/time";
import { describe, expect, it } from "vitest";

import { RegisterStrategy } from "./register-strategy";

describe("RegisterStrategy", () => {
	const strategy = new RegisterStrategy("");

	describe("create", () => {
		it("creates a register holding the value", () => {
			const entity = strategy.create("A", "title");

			expect(entity.key).toBe("title");
			expect(entity.current).toBe("A");
		});

		it("creates a register holding the default for an undefined value", () => {
			expect(strategy.create(undefined, "title").current).toBe("");
		});

		it("stamps the register with the supplied time", () => {
			expect(strategy.create("A", "title", Time.epoch()).timestamp.toString()).toBe(Time.epoch().toString());
		});
	});

	describe("reconcile", () => {
		it("writes the register only when the value changes", () => {
			const entity = strategy.create("en", "language");
			const revision = entity.revision;

			strategy.reconcile(entity, "en");
			expect(entity.revision).toBe(revision);

			strategy.reconcile(entity, "cs");
			expect(entity.current).toBe("cs");
			expect(entity.revision).toBeGreaterThan(revision);
		});

		it("stores an object by reference instead of cloning it", () => {
			const value = { text: "red" };
			const entity = strategy.create(value, "label");

			expect(entity.current).toBe(value);

			const next = { text: "blue" };

			strategy.reconcile(entity, next);

			expect(entity.current).toBe(next);
		});

		it("ignores an entity that is not a register", () => {
			const entity = new LWWMap({}, "row");
			const revision = entity.revision;

			strategy.reconcile(entity, "A");

			expect(entity.revision).toBe(revision);
		});
	});
});
