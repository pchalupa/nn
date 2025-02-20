import { Subscribers } from "./Subscribers";
import { Collection } from "./schema/Collection";
import { createDocumentOf } from "./schema/Document";
import type { Snapshot } from "./snapshot/Snapshot";
import { SnapshotManager } from "./snapshot/SnapshotManager";

type Options<SchemaType> = { schema: Schema<SchemaType> };
type Schema<Type> = (entity: Entities) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<Schema extends object> {
	private snapshotManager = new SnapshotManager();
	private subscribers: Subscribers = new Subscribers();

	constructor(private _schema: Schema) {}

	get schema() {
		return this._schema;
	}

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

	getSnapshotOf<Type>(selector: (store: Schema) => Type): Snapshot<Type> {
		let snapshot = this.snapshotManager.getSnapshotById<Type>(selector);
		const onPush = () => this.notifySubscribers();

		if (!snapshot) {
			snapshot = this.snapshotManager.createSnapshot<Type>(selector, selector(this.schema), onPush);
		}

		return snapshot;
	}

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const schema = options.schema({ document: createDocumentOf, collection: Collection.createCollectionOf });

		return new Store(schema);
	}
}
