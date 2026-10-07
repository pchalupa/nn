import { RGA } from "@nn/entities/RGA";
import type { Repository } from "@nn/repository";
import { array, object, string } from "@nn/schema";
import { describe, expect, it, vi } from "vitest";

import { State } from "./State";
import { Store } from "./Store";

const repositoryMock = (overrides: Partial<Repository> = {}): Repository => ({
	init: vi.fn().mockResolvedValue(undefined),
	get: vi.fn().mockResolvedValue(undefined),
	getAll: vi.fn().mockResolvedValue([]),
	set: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
	...overrides,
});

const ticketsSchema = object({ tickets: array(object({ name: string() })) });

describe("Store", () => {
	it("creates a store from a state", () => {
		const store = new Store(new State({ tickets: new RGA() }));

		expect(store.read(["tickets"])).toStrictEqual([]);
	});

	it("creates a store from a schema", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });

		expect(store).toBeInstanceOf(Store);
		expect(store.read(["tickets"])).toStrictEqual([]);
	});

	it("initializes and hydrates a store from a repository", async () => {
		const repository = repositoryMock({
			getAll: vi.fn().mockResolvedValue([{ key: "1", name: "Test" }]),
		});

		const store = await Store.fromSchema({ schema: ticketsSchema, repository });

		expect(repository.init).toHaveBeenCalledWith(ticketsSchema.properties);
		expect(repository.getAll).toHaveBeenCalledWith("tickets");
		expect(store.read(["tickets"])).toStrictEqual([{ key: "1", name: "Test" }]);
	});

	it("creates a register for a top-level string", async () => {
		const store = await Store.fromSchema({ schema: object({ language: string() }) });

		expect(store.read(["language"])).toBeUndefined();
	});

	it("hydrates and persists a register through a repository", async () => {
		const repository = repositoryMock({ get: vi.fn().mockResolvedValue("cs") });
		const store = await Store.fromSchema({ schema: object({ language: string() }), repository });

		expect(repository.get).toHaveBeenCalledWith("language", "language");
		expect(store.read(["language"])).toBe("cs");

		store.update(["language"], () => "en");

		expect(store.read(["language"])).toBe("en");
		await vi.waitFor(() => expect(repository.set).toHaveBeenCalledWith("language", "en", "language"));
	});

	it("rejects a top-level object", async () => {
		await expect(Store.fromSchema({ schema: object({ settings: object({ theme: string() }) }) })).rejects.toThrow(
			TypeError,
		);
	});

	it("adds a row to a collection", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });

		store.update(["tickets"], (tickets) => {
			tickets.push({ name: "Test" });
		});

		expect(store.read(["tickets"])).toMatchObject([{ name: "Test" }]);
	});

	it("notifies subscribers when an entity is updated", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();

		store.subscribe(listener);
		store.update(["tickets"], (tickets) => {
			tickets.push({ name: "Test" });
		});

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("removes a subscriber", async () => {
		const store = await Store.fromSchema({ schema: ticketsSchema });
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		unsubscribe();
		store.update(["tickets"], (tickets) => {
			tickets.push({ name: "Test" });
		});

		expect(listener).not.toHaveBeenCalled();
	});
});
