import { describe, expect, it, vi } from "vitest";

import { VersionedCache } from "./versioned-cache";

describe("VersionedCache", () => {
	it("loads once per version and returns the stored value", () => {
		const cache = new VersionedCache<object, { id: number }>();
		const key = {};
		const load = vi.fn(() => ({ id: 1 }));
		const first = cache.ensure(key, 1, load);

		expect(cache.ensure(key, 1, load)).toBe(first);
		expect(load).toHaveBeenCalledExactlyOnceWith(key);
	});

	it("loads again when the version changes", () => {
		const cache = new VersionedCache<object, { id: number }>();
		const key = {};
		const load = vi.fn(() => ({ id: 2 }));

		cache.ensure(key, 1, () => ({ id: 1 }));

		expect(cache.ensure(key, 2, load)).toStrictEqual({ id: 2 });
		expect(cache.ensure(key, 2, load)).toStrictEqual({ id: 2 });
		expect(load).toHaveBeenCalledOnce();
	});

	it("keeps keys apart", () => {
		const cache = new VersionedCache<object, { id: number }>();
		const first = {};
		const second = {};

		expect(cache.ensure(first, 1, () => ({ id: 1 }))).toStrictEqual({ id: 1 });
		expect(cache.ensure(second, 1, () => ({ id: 2 }))).toStrictEqual({ id: 2 });
		expect(cache.ensure(first, 1, () => ({ id: 3 }))).toStrictEqual({ id: 1 });
	});

	it.each([undefined, null])("keeps the empty value %j", (value) => {
		const cache = new VersionedCache<object, typeof value>();
		const key = {};
		const load = vi.fn(() => value);

		cache.ensure(key, 1, load);
		cache.ensure(key, 1, load);

		expect(load).toHaveBeenCalledOnce();
	});

	it("passes the key to the loader", () => {
		const cache = new VersionedCache<object, object>();
		const key = {};
		let received: object | undefined;

		cache.ensure(key, 1, (value) => {
			received = value;

			return {};
		});

		expect(received).toBe(key);
	});
});
