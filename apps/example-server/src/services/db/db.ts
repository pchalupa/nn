import { join } from "path";
import { readFile, writeFile } from "fs/promises";

const database = join(__dirname, "db.json");

export async function update(data: Record<string, unknown>): Promise<void> {
	const db = await readDb();

	await writeDb(Object.assign(db, data));
}

export async function get(): Promise<Record<string, unknown>> {
	const db = await readDb();

	return db;
}

async function readDb(): Promise<Record<string, unknown>> {
	const db = await readFile(database, "utf-8");

	return JSON.parse(db);
}

async function writeDb(data: Record<string, unknown>) {
	await writeFile(database, JSON.stringify(data, null, 2), "utf-8");
}
