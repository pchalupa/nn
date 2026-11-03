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

const attach = (repository: Repository) => {
	const store = new Store(schema);
	const sync = RepositorySync.attach(store, repository);
	const failures: unknown[] = [];
	const bootstrapped = new Promise<void>((resolve) => {
		sync.delegate = {
			syncEngineDidBootstrap: () => resolve(),
			syncEngineDidFail: (_engine, error) => {
				failures.push(error);
			},
		};
	});

	return { store, sync, failures, bootstrapped };
};

describe("RepositorySync", () => {
	it("initializes the repository with the store's fields", async () => {
		const repository = repositoryMock();
		const { bootstrapped } = attach(repository);

		await bootstrapped;

		expect(repository.init).toHaveBeenCalledExactlyOnceWith(schema.properties);
	});

	it("restores each field from the repository by name", async () => {
		const repository = repositoryMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const { store, bootstrapped } = attach(repository);

		await bootstrapped;

		expect(repository.get).toHaveBeenCalledWith("tickets");
		expect(repository.get).toHaveBeenCalledWith("language");
		expect(store.state.read().language).toBe("cs");
	});

	it("persists each changed field under its name", async () => {
		const repository = repositoryMock();
		const { store, bootstrapped } = attach(repository);

		await bootstrapped;
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

		const { store, failures } = attach(repository);

		await vi.waitFor(() => expect(failures).toStrictEqual([failure]));
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(repository.get).not.toHaveBeenCalled();
		expect(repository.set).not.toHaveBeenCalled();
	});

	it("closes the repository on detach", async () => {
		const repository = repositoryMock();
		const { sync, bootstrapped } = attach(repository);

		await bootstrapped;
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
		const { sync, bootstrapped } = attach(repository);

		await bootstrapped;

		expect(() => sync.detach()).not.toThrow();
	});
});
