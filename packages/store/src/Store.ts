import { Subscribers } from "./Subscribers";
import { InMemoryRepository } from "./repository/InMemoryRepository";
import type { Snapshot } from "./repository/snapshot/Snapshot";
import { Collection } from "./schema/Collection";
import { createDocumentOf } from "./schema/Document";

type Options<SchemaType> = { schema: Schema<SchemaType> };
type Schema<Type> = (entity: Entities) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<Schema extends object> {
	private subscribers: Subscribers = new Subscribers();
	private repository = new InMemoryRepository();

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
		let snapshot = this.repository.getSnapshotById<Type>(selector);

		if (!snapshot) {
			const onPush = () => {
				this.notifySubscribers();

				// Notify repository
				// I need to select the correct place in repository to update

				// this.repository.update(selector(this.schema));
			};

			snapshot = this.repository.createSnapshot<Type>(selector, selector(this.schema), onPush);
		}

		return snapshot;
	}

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const schema = options.schema({ document: createDocumentOf, collection: Collection.createCollectionOf });

		return new Store(schema);
	}
}
