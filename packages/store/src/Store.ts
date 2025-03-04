import { EventEmitter } from "@nn/event-emitter";
import { InMemoryRepository } from "@nn/in-memory-repository";
import type { Repository } from "@nn/repository";
import { Collection } from "./Collection";
import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

type RepositoryOption<Provider extends Repository = unknown> = {
	alias: string;
	provider: Provider;
	options: ConstructorParameters<Provider>;
};
type Options<SchemaType, Repositories extends RepositoryOption[]> = {
	schema: Schema<SchemaType>;
	repositories?: Repositories;
};
type Schema<Type> = (entity: Entities, repositories: Record<string, Repository>) => Type;
type Entities = { collection: () => Collection<unknown> };

export class Store<State extends object> {
	private snapshotManager = new SnapshotManager();
	public events = new EventEmitter<{ update: [] }>();

	constructor(
		private state: State,
		private repositoryManager?: RepositoryManager,
	) {}

	getSnapshotOf<Type>(selector: (state: State) => Type): Snapshot<Type> {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot<Type>(snapshotId);

		if (!snapshot) {
			const data = selector(this.state);
			const onUpdate = () => {
				this.snapshotManager.invalidateSnapshot(snapshotId);
				this.events.emit("update");
			};

			snapshot = this.snapshotManager.createSnapshot(snapshotId, data);
			snapshot.events.once("update", onUpdate);
		}

		return snapshot;
	}

	// Consider switching to a builder pattern
	static createWithOptions<Schema extends object, Repositories extends RepositoryOption[] = []>(
		options: Options<Schema, Repositories>,
	) {
		const repositoryManager = new RepositoryManager();
		const repositories = options.repositories ?? [];

		repositories.push({ alias: "ephemeral", provider: InMemoryRepository, options: [] });

		const repos = repositories.reduce<Record<string, Repository>>((res, { alias, provider, options }) => {
			const repository = new provider(options);

			repositoryManager.registerRepository(alias, repository);

			res[alias] = repositoryManager.getRepository(alias);

			return res;
		}, {});

		const state = options.schema(
			{
				collection: <T>(options: { data?: T; repository: Repository }) => {
					const repository = options?.repository ?? repositoryManager.getRepository("ephemeral");
					const collection = new Collection<T>(options?.data, repository);

					return collection;
				},
			},
			repos,
		);

		return new Store(state, repositoryManager);
	}
}

class RepositoryManager {
	private repositories = new Map<string, Repository>();

	registerRepository(alias: string, provider: Repository) {
		this.repositories.set(alias, provider);
	}

	getRepository(alias: string) {
		return this.repositories.get(alias);
	}
}
