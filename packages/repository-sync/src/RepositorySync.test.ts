import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import type { Repository } from "@nn/repository";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { Time } from "@nn/time";
import { describe, expect, it, vi } from "vitest";

import { RepositorySync } from "./RepositorySync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const repositoryMock = (entries: Record<string, unknown> = {}): Repository => ({
	init: vi.fn().mockResolvedValue(undefined),
	get: vi.fn().mockImplementation(async (name: string) => entries[name]),
	set: vi.fn().mockResolvedValue(undefined),
	close: vi.fn(),
});

const flush = () => new Promise((resolve) => setTimeout(resolve));

const attach = async (repository: Repository) => {
	const store = new Store(schema);
	const sync = RepositorySync.attach(store, repository);

	await flush();

	return { store, sync };
};

describe("RepositorySync", () => {
	it("initializes the repository with the store's fields", async () => {
		const repository = repositoryMock();

		await attach(repository);

		expect(repository.init).toHaveBeenCalledExactlyOnceWith(schema.properties);
	});

	it("restores each field from the repository by name", async () => {
		const repository = repositoryMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const { store } = await attach(repository);

		expect(repository.get).toHaveBeenCalledWith("tickets");
		expect(repository.get).toHaveBeenCalledWith("language");
		expect(store.state.read().language).toBe("cs");
	});

	it("persists each changed field under its name", async () => {
		const repository = repositoryMock();
		const { store } = await attach(repository);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(repository.set).toHaveBeenCalledExactlyOnceWith(
			"language",
			expect.objectContaining({ key: "language", data: "cs" }),
		);
	});

	it("reads and writes nothing when the repository cannot be initialized", async () => {
		const failure = new Error("blocked");
		const repository = repositoryMock();

		vi.mocked(repository.init).mockRejectedValue(failure);

		const { store } = await attach(repository);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(repository.get).not.toHaveBeenCalled();
		expect(repository.set).not.toHaveBeenCalled();
	});

	it("closes the repository on detach", async () => {
		const repository = repositoryMock();
		const { sync } = await attach(repository);

		sync.detach();

		expect(repository.close).toHaveBeenCalledOnce();
	});

	it("detaches from a repository that has nothing to close", async () => {
		const repository: Repository = {
			init: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(undefined),
			set: vi.fn().mockResolvedValue(undefined),
			close: vi.fn(),
		};
		const { sync } = await attach(repository);

		expect(() => sync.detach()).not.toThrow();
	});
});
