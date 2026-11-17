import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { InvalidatableCache } from "./invalidatable-cache";

describe("InvalidatableCache", () => {
	it("loads once and returns the stored value", () => {
		const cache = new InvalidatableCache<{ id: number }>();
		const load = vi.fn(() => ({ id: 1 }));
		const first = cache.ensure(load);

		expect(cache.ensure(load)).toBe(first);
		expect(load).toHaveBeenCalledOnce();
	});

	it("loads again after it is invalidated", () => {
		const cache = new InvalidatableCache<{ id: number }>();
		const first = cache.ensure(() => ({ id: 1 }));

		cache.invalidate();

		expect(cache.ensure(() => ({ id: 2 }))).toStrictEqual({ id: 2 });
		expect(cache.ensure(() => ({ id: 3 }))).not.toBe(first);
	});

	it.each([0, "", false, undefined, null])("keeps the falsy value %j", (value) => {
		const cache = new InvalidatableCache<typeof value>();
		const load = vi.fn(() => value);

		cache.ensure(load);
		cache.ensure(load);

		expect(load).toHaveBeenCalledOnce();
	});

	it("types ensure by the cached value", () => {
		expectTypeOf<InvalidatableCache<string>["ensure"]>().toEqualTypeOf<(load: () => string) => string>();
	});
});
