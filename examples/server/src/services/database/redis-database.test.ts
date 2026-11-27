import { describe, expect, it, vi } from "vitest";

import { createRedisDatabase } from "./redis-database.js";

describe("createRedisDatabase", () => {
	it("stores fields under the goodstate-example key when no key is given", async () => {
		const client = { hset: vi.fn(async () => 1), hgetall: vi.fn(async () => []) };

		await createRedisDatabase(client).update({ language: "en" });

		expect(client.hset).toHaveBeenCalledExactlyOnceWith("goodstate-example", { language: '"en"' });
	});
});
