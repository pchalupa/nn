import { join } from "path";
import { readFile, writeFile } from "fs/promises";
import logger from "../logger";

const database = join(__dirname, "db.json");

export async function update(data: Record<string, unknown>): Promise<void> {
	try {
		const db = await readDb();

		await writeDb(Object.assign(db, data));
	} catch (_error) {
		logger.error("Failed to update data");
		throw new Error("Failed to update data");
	}
}

export async function get(): Promise<Record<string, unknown>> {
	try {
		const db = await readDb();

		return db;
	} catch (_error) {
		logger.error("Failed to get data");
		throw new Error("Failed to get data");
	}
}

async function readDb(): Promise<Record<string, unknown>> {
	try {
		const db = await readFile(database, "utf-8");

		return JSON.parse(db);
	} catch (_error) {
		logger.error("Failed to read database");
		throw new Error("Failed to read database");
	}
}

async function writeDb(data: Record<string, unknown>): Promise<void> {
	try {
		await writeFile(database, JSON.stringify(data, null, 2), "utf-8");
	} catch (_error) {
		logger.error("Failed to write database");
		throw new Error("Failed to write database");
	}
}
