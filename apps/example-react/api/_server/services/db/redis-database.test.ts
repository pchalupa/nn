import { describe, expect, it, vi } from "vitest";

import { createRedisDatabase, type RedisHashClient } from "./redis-database";

const fakeClient = (): RedisHashClient => {
	const hashes = new Map<string, Record<string, string>>();

	return {
		hset: async (key, fields) => {
			hashes.set(key, { ...hashes.get(key), ...fields });

			return Object.keys(fields).length;
		},
		hgetall: async (key) => hashes.get(key) ?? null,
	};
};

describe("createRedisDatabase", () => {
	it("returns an empty snapshot before anything is stored", async () => {
		expect(await createRedisDatabase(fakeClient()).get()).toStrictEqual({});
	});

	it("merges updates into the stored snapshot", async () => {
		const db = createRedisDatabase(fakeClient());

		await db.update({ language: "en", tags: [{ name: "a" }] });
		await db.update({ language: "cs" });

		expect(await db.get()).toStrictEqual({ language: "cs", tags: [{ name: "a" }] });
	});

	it("keeps strings that look like other JSON values as strings", async () => {
		const db = createRedisDatabase(fakeClient());

		await db.update({ a: "42", b: "true", c: "null", d: null });

		expect(await db.get()).toStrictEqual({ a: "42", b: "true", c: "null", d: null });
	});

	it("stores each top-level key as a JSON-encoded field in one write", async () => {
		const client = fakeClient();
		const hset = vi.spyOn(client, "hset");

		await createRedisDatabase(client, "doc").update({ users: [], language: "en" });

		expect(hset).toHaveBeenCalledExactlyOnceWith("doc", { users: "[]", language: '"en"' });
	});

	it("ignores an empty update", async () => {
		const client = fakeClient();
		const hset = vi.spyOn(client, "hset");

		await createRedisDatabase(client).update({});

		expect(hset).not.toHaveBeenCalled();
	});
});
