import { Subscribers } from "./Subscribers";
import type { Snapshot } from "./repository/snapshot/Snapshot";
import { SnapshotManager } from "./repository/snapshot/SnapshotManager";
import { Collection } from "./schema/Collection";
import { createDocumentOf } from "./schema/Document";

type Options<SchemaType> = { schema: Schema<SchemaType> };
type Schema<Type> = (entity: Entities) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<State extends object> {
	private snapshotManager = new SnapshotManager();
	private subscribers: Subscribers = new Subscribers();

	constructor(private state: State) {}

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

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const state = options.schema({ document: createDocumentOf, collection: Collection.createCollectionOf });

		return new Store(state);
	}
}
