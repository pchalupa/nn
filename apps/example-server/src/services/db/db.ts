import { join } from "path";
import { readFile, writeFile } from "fs/promises";

const database = join(__dirname, "db.json");

export async function update(data: Record<string, unknown>): Promise<void> {
	try {
		const db = await readDb();

		await writeDb(Object.assign(db, data));
	} catch (error) {
		throw new Error("Failed to update data");
	}
}

export async function get(): Promise<Record<string, unknown>> {
	try {
		const db = await readDb();

		return db;
	} catch (error) {
		throw new Error("Failed to get data");
	}
}

async function readDb(): Promise<Record<string, unknown>> {
	try {
		const db = await readFile(database, "utf-8");

		return JSON.parse(db);
	} catch (error) {
		throw new Error("Failed to read database");
	}
}

async function writeDb(data: Record<string, unknown>): Promise<void> {
	try {
		await writeFile(database, JSON.stringify(data, null, 2), "utf-8");
	} catch (error) {
		throw new Error("Failed to write database");
	}
}
