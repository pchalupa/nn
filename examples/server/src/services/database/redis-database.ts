import type { Database } from "./database";

export interface RedisHashClient {
	hset(key: string, fields: Record<string, string>): Promise<unknown>;
	hgetall(key: string): Promise<unknown>;
}

export function createRedisDatabase(client: RedisHashClient, key = "nn-example"): Database {
	return {
		get: async () => {
			const fields = (await client.hgetall(key)) ?? [];

			if (!Array.isArray(fields)) throw new TypeError(`Unexpected fields in "${key}"`);

			const decoded: Record<string, unknown> = {};

			for (let index = 0; index < fields.length; index += 2) {
				const field: unknown = fields[index];
				const value: unknown = fields[index + 1];

				if (typeof field !== "string" || typeof value !== "string") {
					throw new TypeError(`Unexpected field at ${index} in "${key}"`);
				}

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
