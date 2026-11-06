import { assertString } from "@nn/guards/assert-string";

import type { Database } from "./database";

export interface RedisHashClient {
	hset(key: string, fields: Record<string, string>): Promise<unknown>;
	hgetall(key: string): Promise<Record<string, unknown> | null>;
}

export function createRedisDatabase(client: RedisHashClient, key = "nn-example"): Database {
	return {
		get: async () => {
			const fields = (await client.hgetall(key)) ?? {};

			const decoded: Record<string, unknown> = {};

			for (const field in fields) {
				const value = fields[field];

				assertString(value, `Unexpected value of field "${field}" in "${key}"`);

				decoded[field] = JSON.parse(value);
			}

			return decoded;
		},
		update: async (data) => {
			const fields: Record<string, string> = {};

			for (const field in data) {
				fields[field] = JSON.stringify(data[field]);
			}

			if (Object.keys(fields).length > 0) await client.hset(key, fields);
		},
	};
}
