export interface Database {
	get(): Promise<Record<string, unknown>>;
	update(data: Record<string, unknown>): Promise<void>;
}

export function createMemoryDatabase(): Database {
	const db: Record<string, unknown> = {};

	return {
		get: async () => ({ ...db }),
		update: async (data) => {
			Object.assign(db, data);
		},
	};
}
