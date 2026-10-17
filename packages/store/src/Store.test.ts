import { LWWRegister } from "@nn/entities/LWWRegister";
import { RGA } from "@nn/entities/RGA";
import type { Repository } from "@nn/repository";
import { array, object, string } from "@nn/schema";
import { Time } from "@nn/time";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CollectionEntry, RegisterEntry } from "./persistence";
import { State } from "./State";
import { Store } from "./Store";

const repositoryMock = (overrides: Partial<Repository> = {}): Repository => ({
	init: vi.fn().mockResolvedValue(undefined),
	get: vi.fn().mockResolvedValue(undefined),
	set: vi.fn().mockResolvedValue(undefined),
	...overrides,
});

const ticketsSchema = object({ tickets: array(object({ name: string() })) });

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

describe("Store", () => {
	afterEach(() => vi.restoreAllMocks());

	it("creates a store from a state or a schema", async () => {
		const fromState = new Store(State.fromEntries({ tickets: new RGA<LWWRegister<{ key: string }>>() }));
		const fromSchema = await Store.fromSchema({ schema: ticketsSchema });

		expect(fromState.read(["tickets"])).toStrictEqual([]);
		expect(fromSchema).toBeInstanceOf(Store);
		expect(fromSchema.read(["tickets"])).toStrictEqual([]);
	});

	it("rejects unsupported schema shapes", async () => {
		await expect(Store.fromSchema({ schema: object({ settings: object({ theme: string() }) }) })).rejects.toThrow(
			TypeError,
		);
	});

	it("reads and updates through paths and notifies subscribers once per update", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();
		store.subscribe(listener);

		store.update(["tickets"], (rows) => {
			rows.push({ key: "1", name: "First" }, { key: "2", name: "Second" });
			return rows;
		});
		store.update(["tickets", "1", "name"], () => "Changed");
		store.update(["tickets", "2"], (row) => row);

		expect(store.read(["tickets"])).toStrictEqual([
			{ key: "1", name: "Changed" },
			{ key: "2", name: "Second" },
		]);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("removes a subscriber", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		unsubscribe();
		store.update(["tickets"], () => [{ name: "Test" }]);

		expect(listener).not.toHaveBeenCalled();
	});

	it("refreshes views and notifies when entities change outside the store", () => {
		const tickets = new RGA<LWWRegister<{ key: string; title: string }>>();
		const store = new Store(State.fromEntries({ tickets }));
		const before = store.read(["tickets"]);
		const listener = vi.fn();
		store.subscribe(listener);

		tickets.merge(new RGA([new LWWRegister({ key: "1", title: "Merged" }, "1")]));

		expect(store.read(["tickets"])).toStrictEqual([{ key: "1", title: "Merged" }]);
		expect(store.read(["tickets"])).not.toBe(before);
		expect(listener).toHaveBeenCalledOnce();
	});

	it("merges concurrent edits to different rows", () => {
		let time = 1000;
		vi.spyOn(Date, "now").mockImplementation(() => time);
		const localRows = new RGA([
			new LWWRegister({ key: "1", name: "First" }, "1"),
			new LWWRegister({ key: "2", name: "Second" }, "2"),
		]);
		const remoteRows = new RGA([
			new LWWRegister({ key: "1", name: "First" }, "1"),
			new LWWRegister({ key: "2", name: "Second" }, "2"),
		]);
		const local = new Store(State.fromEntries({ tickets: localRows }));
		const remote = new Store(State.fromEntries({ tickets: remoteRows }));

		time = 2000;
		remote.update(["tickets", "2", "name"], () => "Remote");
		time = 3000;
		local.update(["tickets", "1", "name"], () => "Local");
		localRows.merge(remoteRows);

		expect(local.read(["tickets"])).toStrictEqual([
			{ key: "1", name: "Local" },
			{ key: "2", name: "Remote" },
		]);
	});

	it("loads persisted roots before construction without writing them back", async () => {
		const values = new Map<string, unknown>([
			["tickets", storedCollection("tickets", [storedRegister("1", { key: "1", name: "Stored" })])],
			["language", storedRegister("language", "cs")],
		]);
		const repository = repositoryMock({ get: vi.fn().mockImplementation(async (name: string) => values.get(name)) });
		const schema = object({ tickets: array(object({ name: string() })), language: string() });

		const store = await Store.fromSchema({ schema, repository });

		expect(repository.init).toHaveBeenCalledWith(schema.properties);
		expect(repository.get).toHaveBeenCalledWith("tickets");
		expect(repository.get).toHaveBeenCalledWith("language");
		expect(store.read(["tickets"])).toStrictEqual([{ key: "1", name: "Stored" }]);
		expect(store.read(["language"])).toBe("cs");
		expect(repository.set).not.toHaveBeenCalled();
	});

	it("leaves defaults without a new timestamp until the first real edit and persists it", async () => {
		const repository = repositoryMock();
		const now = vi.spyOn(Time, "now");
		const store = await Store.fromSchema({ schema: object({ language: string() }), repository });

		store.update(["language"], (language) => language);
		expect(now).not.toHaveBeenCalled();
		expect(repository.set).not.toHaveBeenCalled();

		store.update(["language"], () => "cs");
		expect(now).toHaveBeenCalledOnce();
		expect(repository.set).toHaveBeenCalledExactlyOnceWith("language", {
			key: "language",
			data: "cs",
			metadata: { kind: "register", timestamp: expect.any(String) },
		});
	});

	it("persists one complete collection per change", async () => {
		const writes: unknown[] = [];
		const repository = repositoryMock({
			set: async (name, entry) => {
				writes.push([name, entry]);
			},
			get: vi
				.fn()
				.mockResolvedValue(
					storedCollection("tickets", [
						storedRegister("1", { key: "1", name: "First" }),
						storedRegister("2", { key: "2", name: "Second" }),
					]),
				),
		});
		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		store.update(["tickets"], (rows) => [
			{ ...rows[0], name: "Changed" },
			{ key: "3", name: "Added" },
		]);

		await vi.waitFor(() => expect(writes).toHaveLength(1));
		expect(writes[0]).toStrictEqual([
			"tickets",
			expect.objectContaining({
				key: "tickets",
				data: [expect.objectContaining({ key: "1" }), expect.objectContaining({ key: "3" })],
			}),
		]);

		store.update(["tickets"], () => []);
		await vi.waitFor(() => expect(writes).toHaveLength(2));
		expect(writes[1]).toStrictEqual(["tickets", storedCollection("tickets", [])]);
	});

	it("persists external changes even without store listeners", async () => {
		const language = new LWWRegister("cs");
		const state = State.fromEntries({ language });
		const repository = repositoryMock();
		const store = new Store(state, repository);

		language.current = "en";

		expect(store.read(["language"])).toBe("en");

		await vi.waitFor(() =>
			expect(repository.set).toHaveBeenCalledExactlyOnceWith("language", state.capture("language")),
		);
	});

	it("logs persistence failures and keeps persisting later changes", async () => {
		const failure = new Error("storage unavailable");
		const report = vi.spyOn(console, "error").mockImplementation(() => {});
		const persisted: unknown[] = [];
		const repository = repositoryMock({
			set: async (name, entry) => {
				if (name === "first") throw failure;
				persisted.push(entry);
			},
		});
		const store = new Store(
			State.fromEntries({ first: new LWWRegister("Initial"), second: new LWWRegister("Initial") }),
			repository,
		);

		store.update(["first"], () => "Fails");
		store.update(["second"], () => "Saved");

		await vi.waitFor(() => expect(persisted).toMatchObject([{ data: "Saved" }]));
		expect(report).toHaveBeenCalledExactlyOnceWith("Failed to persist Store record.", failure);
	});

	it("rejects repository read errors and corrupt entries without writing defaults", async () => {
		const failure = new Error("read failed");
		const unreadable = repositoryMock({ get: vi.fn().mockRejectedValue(failure) });
		await expect(Store.fromSchema({ schema: ticketsSchema, repository: unreadable })).rejects.toBe(failure);
		expect(unreadable.set).not.toHaveBeenCalled();

		const corrupt = repositoryMock({ get: vi.fn().mockResolvedValue({}) });
		await expect(Store.fromSchema({ schema: ticketsSchema, repository: corrupt })).rejects.toThrow("Invalid persisted");
		expect(corrupt.set).not.toHaveBeenCalled();
	});
});
