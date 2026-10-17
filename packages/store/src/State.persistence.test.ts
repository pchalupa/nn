import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import { array, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreError } from "./errors/StoreError";
import type { CollectionEntry, RegisterEntry, RootEntry } from "./persistence";
import { State } from "./State";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const savedTimestamp = "2026-10-15T00:00:00.000Z+00005+saved-replica";

const storedRegister = (key: string, data: unknown, timestamp = savedTimestamp): RegisterEntry => ({
	key,
	data,
	metadata: { kind: "register", timestamp },
});

const storedCollection = (key: string, data: readonly RegisterEntry[]): CollectionEntry => ({
	key,
	data,
	metadata: { kind: "collection" },
});

const epoch = "1970-01-01T00:00:00.000Z+00000+00000000-0000-0000-0000-000000000000";

function isCollection(entry: RootEntry): entry is CollectionEntry {
	return entry.metadata.kind === "collection";
}

describe("State persistence", () => {
	afterEach(() => vi.restoreAllMocks());

	it("captures roots with their keys, row order and timestamps", () => {
		const now = vi.spyOn(Time, "now");
		const state = State.fromSchema(schema);

		expect(state.capture("language")).toStrictEqual(storedRegister("language", undefined, epoch));
		expect(now).not.toHaveBeenCalled();

		state.write(["tickets"], () => [
			{ key: "z", title: "First" },
			{ key: "a", title: "Second" },
		]);

		expect(state.capture("tickets")).toStrictEqual(
			storedCollection("tickets", [
				storedRegister("z", { key: "z", title: "First" }, expect.any(String)),
				storedRegister("a", { key: "a", title: "Second" }, expect.any(String)),
			]),
		);
		const captured = state.capture("tickets");
		if (!isCollection(captured)) {
			throw new Error("Expected a captured collection.");
		}
		for (const row of captured.data) {
			expect(Time.fromTimestamp(row.metadata.timestamp).isAfter(Time.epoch())).toBe(true);
		}
	});

	it("round-trips untouched schema defaults without minting timestamps", () => {
		const source = State.fromSchema(schema);
		const saved = source.capture("language");
		const now = vi.spyOn(Time, "now");

		const restored = State.fromSchema(schema, new Map([["language", saved]]));

		expect(restored.capture("language")).toStrictEqual(storedRegister("language", undefined, epoch));
		expect(restored.capture("language")).toStrictEqual(saved);
		expect(now).not.toHaveBeenCalled();
	});

	it("timestamps the first write over a schema default", () => {
		const state = State.fromSchema(schema);

		state.write(["language"], () => "cs");

		const captured = state.capture("language");
		expect(state.read(["language"])).toBe("cs");
		if (captured.metadata.kind !== "register") throw new Error("Expected a captured register.");
		expect(Time.fromTimestamp(captured.metadata.timestamp).isAfter(Time.epoch())).toBe(true);
	});

	it("restores captured roots without minting timestamps or notifying", () => {
		const source = State.fromSchema(schema);
		source.write(["tickets"], () => [{ key: "1", title: "First" }]);
		source.write(["language"], () => "cs");
		const persisted = new Map([
			["tickets", source.capture("tickets")],
			["language", source.capture("language")],
		]);
		const now = vi.spyOn(Time, "now");

		const state = State.fromSchema(schema, persisted);

		expect(now).not.toHaveBeenCalled();
		expect(state.read(["tickets"])).toStrictEqual([{ key: "1", title: "First" }]);
		expect(state.read(["language"])).toBe("cs");
		expect(state.capture("tickets")).toStrictEqual(persisted.get("tickets"));
		expect(state.capture("language")).toStrictEqual(persisted.get("language"));
	});

	it("keeps defaults for missing records and restores a stored undefined value", () => {
		const state = State.fromSchema(schema, new Map([["language", storedRegister("language", undefined)]]));

		expect(state.read(["tickets"])).toStrictEqual([]);
		expect(state.read(["language"])).toBeUndefined();
		expect(state.capture("language").metadata).toStrictEqual({ kind: "register", timestamp: savedTimestamp });
	});

	it("normalizes restored rows and detaches them from the stored objects", () => {
		const stored = storedCollection("tickets", [storedRegister("1", { key: "1", extra: true })]);
		const state = State.fromSchema(schema, new Map([["tickets", stored]]));

		expect(state.read(["tickets"])).toStrictEqual([{ key: "1", title: undefined }]);

		state.write(["tickets", "1", "title"], () => "Changed");

		expect(stored.data[0]?.data).toStrictEqual({ key: "1", extra: true });
	});

	it("rejects entries of the wrong kind, key or shape", () => {
		const cases: Array<[string, unknown]> = [
			["tickets", storedRegister("tickets", [])],
			["language", storedCollection("language", [])],
			["language", storedRegister("old-random-key", "cs")],
			["language", { key: "language", data: "cs", metadata: { kind: "register", timestamp: null } }],
			["language", storedRegister("language", "cs", "not a timestamp")],
			["language", storedRegister("language", 1)],
			["tickets", storedCollection("tickets", [storedRegister("1", "row")])],
			["tickets", { key: "tickets", data: ["row"], metadata: { kind: "collection" } }],
			["tickets", {}],
			["tickets", "junk"],
		];

		for (const [name, stored] of cases) {
			expect(() => State.fromSchema(schema, new Map([[name, stored]]))).toThrow(StoreError);
			expect(() => State.fromSchema(schema, new Map([[name, stored]]))).toThrow(
				`Invalid persisted state for "${name}"`,
			);
		}
	});

	it("merges stored data into hand-built entries by timestamp", () => {
		const row = new LWWRegister({ key: "1", title: "Newer" }, "1");
		const tickets = new RGA([row]);
		const language = new LWWRegister<string | undefined>(undefined, "language", Time.epoch());
		const state = State.fromEntries({ tickets, language });

		expect(state.read(["language"])).toBeUndefined();

		tickets.merge(new RGA([new LWWRegister({ key: "1", title: "Older" }, "1", Time.fromTimestamp(savedTimestamp))]));
		language.merge(new LWWRegister("cs", "language", Time.fromTimestamp(savedTimestamp)));

		expect(tickets.find("1")).toBe(row);
		expect(state.read(["tickets", "1", "title"])).toBe("Newer");
		expect(state.read(["language"])).toBe("cs");
	});
});
