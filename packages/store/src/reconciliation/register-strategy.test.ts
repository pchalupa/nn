import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
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

		it("ignores an entity that is not a register", () => {
			const entity = new LWWMap({}, "item");
			const revision = entity.revision;

			strategy.reconcile(entity, "A");

			expect(entity.revision).toBe(revision);
		});
	});

	describe("conform", () => {
		it("returns the remote register", () => {
			const remote = new LWWRegister("A", "title", Time.now());

			expect(strategy.conform(remote)).toBe(remote);
		});

		it("returns undefined for another kind", () => {
			expect(strategy.conform(new LWWMap({}, "title"))).toBeUndefined();
		});
	});
});
