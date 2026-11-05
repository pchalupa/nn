import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

import logger from "../logger";

const database = process.env.DB_PATH && resolve(process.env.DB_PATH);

export async function update(data: Record<string, unknown>): Promise<void> {
	try {
		const db = await readDb();

		await writeDb(Object.assign(db, data));
	} catch (error) {
		logger.error("Failed to update data");
		throw new Error("Failed to update data", { cause: error });
	}
}

export async function get(): Promise<Record<string, unknown>> {
	try {
		const db = await readDb();

		return db;
	} catch (error) {
		logger.error("Failed to get data");
		throw new Error("Failed to get data", { cause: error });
	}
}

export async function reset(): Promise<void> {
	try {
		await writeDb({});
	} catch (error) {
		logger.error("Failed to reset data");
		throw new Error("Failed to reset data", { cause: error });
	}
}

async function readDb(): Promise<Record<string, unknown>> {
	try {
		if (!database) throw new Error("Unable to locate database");

		const db = await readFile(database, "utf-8");

		return JSON.parse(db);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};

		logger.error("Failed to read database");
		throw new Error("Failed to read database", { cause: error });
	}
}

async function writeDb(data: Record<string, unknown>): Promise<void> {
	try {
		if (!database) throw new Error("Unable to locate database");

		await writeFile(database, JSON.stringify(data, null, 2), "utf-8");
	} catch (error) {
		logger.error("Failed to write database");
		throw new Error("Failed to write database", { cause: error });
	}
}
