import type { Repository } from "@nn/repository";
import { Subscribers } from "./Subscribers";
import { Collection } from "./schema/Collection";
import { createDocumentOf } from "./schema/Document";
import type { Snapshot } from "./snapshot/Snapshot";
import { SnapshotManager } from "./snapshot/SnapshotManager";

type RepositoryOption<Provider extends Repository> = {
	alias: string;
	provider: Provider;
	options: ConstructorParameters<Provider>;
};
type Options<SchemaType, Repositories> = { schema: Schema<SchemaType>; repositories: Repositories };
type Schema<Type> = (entity: Entities, repositories: Record<string, Repository>) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<State extends object> {
	private snapshotManager = new SnapshotManager();
	private subscribers: Subscribers = new Subscribers();

	constructor(
		private state: State,
		private repositoryManager: RepositoryManager,
	) {}

	addSubscriber(key: string, listener: () => void) {
		this.subscribers.set(key, listener);
	}

	removeSubscriber(key: string) {
		this.subscribers.delete(key);
	}

	notifySubscribers() {
		// biome-ignore lint/complexity/noForEach: Map
		this.subscribers.forEach((listener) => listener());
	}

	getSnapshotOf<Type>(selector: (state: State) => Type): Snapshot<Type> {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot<Type>(snapshotId);

		if (!snapshot) {
			const data = selector(this.state);

			const onPush = (value: Type) => {
				const collection = data.findRoot();

				collection.push(value);
				// data.push(value);
				this.snapshotManager.invalidateSnapshot(snapshotId);
				this.notifySubscribers();
			};

			snapshot = this.snapshotManager.createSnapshot<Type>(snapshotId, data);

			// this should be implemented in some class that extends the snapshot delegate
			snapshot.delegate.didPush = onPush;
		}

		return snapshot;
	}

	// Consider switching to a builder pattern
	static createWithOptions<Schema extends object, Repositories extends RepositoryOption[] = []>(
		options: Options<Schema, Repositories>,
	) {
		const repositoryManager = new RepositoryManager();
		const repositories = options.repositories.reduce<Record<string, Repository>>(
			(res, { alias, provider, options }) => {
				const repository = new provider(options);

				repositoryManager.registerRepository(alias, repository);

				res[alias] = repositoryManager.getRepository(alias)!;

				return res;
			},
			{},
		);

		const state = options.schema(
			{ document: createDocumentOf, collection: Collection.createCollectionOf },
			repositories,
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
