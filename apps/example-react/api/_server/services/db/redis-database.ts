import type { Database } from "./db";

export interface RedisHashClient {
	hset(key: string, fields: Record<string, string>): Promise<unknown>;
	hgetall(key: string): Promise<Record<string, unknown> | null>;
}

export function createRedisDatabase(client: RedisHashClient, key = "nn-example"): Database {
	return {
		get: async () => {
			const fields = (await client.hgetall(key)) ?? {};

			return Object.fromEntries(
				Object.entries(fields).map(([field, value]) => {
					if (typeof value !== "string") throw new TypeError(`Unexpected value of field "${field}" in "${key}"`);

					const decoded: unknown = JSON.parse(value);

					return [field, decoded];
				}),
			);
		},
		update: async (data) => {
			const fields = Object.fromEntries(Object.entries(data).map(([field, value]) => [field, JSON.stringify(value)]));

			if (Object.keys(fields).length > 0) await client.hset(key, fields);
		},
	};
}
