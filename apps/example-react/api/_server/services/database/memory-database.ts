import type { Database } from "./database";

export function createMemoryDatabase(): Database {
	const db: Record<string, unknown> = {};

	return {
		get: async () => ({ ...db }),
		update: async (data) => {
			Object.assign(db, data);
		},
	};
}
