import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

import logger from "../logger";

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

export function createFileDatabase(path: string): Database {
	const database = resolve(path);
	const loading = load(database);
	let writing = Promise.resolve();

	const persist = (db: Record<string, unknown>) => {
		const write = writing.then(() => writeFile(database, JSON.stringify(db, null, 2), "utf-8"));

		writing = write.catch((error: unknown) => logger.error({ err: error }, "Failed to write database"));

		return write;
	};

	return {
		get: async () => ({ ...(await loading) }),
		update: async (data) => {
			const db = await loading;

			Object.assign(db, data);
			await persist(db);
		},
	};
}

async function load(database: string): Promise<Record<string, unknown>> {
	try {
		const db: unknown = JSON.parse(await readFile(database, "utf-8"));

		if (!db || typeof db !== "object" || Array.isArray(db)) {
			throw new Error(`Unexpected database content in ${database}`);
		}

		return { ...db };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};

		throw new Error("Failed to read database", { cause: error });
	}
}
