import { EventEmitter } from "@nn/event-emitter";
import type { RepositoryFactory } from "@nn/repository";
import { Collection } from "./Collection";
import { RepositoryManager } from "./RepositoryManager";
import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

type Options = {
	repository: RepositoryFactory;
};

export class Store<State extends object> {
	private snapshotManager = new SnapshotManager();
	private repositoryManager = new RepositoryManager();
	public events = new EventEmitter<{ update: [] }>();

	constructor(private state: State) {}

	getSnapshotOf<Type>(selector: (state: State) => Type) {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot(snapshotId);

		if (!snapshot) {
			const state = selector(this.state);
			const handleInvalidated = () => this.events.emit("update");

			snapshot = this.snapshotManager.createSnapshot(snapshotId, state);
			snapshot.events.once("invalidated", handleInvalidated);
		}

		// TODO: Remove type casting
		return snapshot as Snapshot<Type> & Type;
	}

	static async createWithOptions<Schema extends object>(
		schema: (entities: {
			collection: <Type extends { id: string }>(options: Options) => Collection<Type>;
		}) => Schema,
	): Promise<Store<Schema>> {
		const store = new Store<Schema>({});

		const entities = {
			collection: <Type extends { id: string }>(options: Options) => {
				return async function collectionFactory(typeName: string) {
					const repository = await store.repositoryManager.get(options.repository);
					const data = (await repository?.getAll(typeName)) ?? [];

					const collection = new Collection<Type>(data);

					collection.events.on("update", async (value) => {
						await repository?.set(value.id, value, typeName);
					});

					return collection;
				};
			},
		};

		const state = schema(entities);

		for await (const id of Object.keys(state)) {
			state[id] = await state[id](id);
		}

		store.state = state;

		return store;
	}
}
