import { Collection } from "./Collection";
import { createDocumentOf } from "./Document";
import { Snapshot } from "./Snapshot";
import { Subscribers } from "./Subscribers";

type Options<SchemaType> = { schema: Schema<SchemaType> };
type Schema<Type> = (entity: Entities) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<Schema extends object> {
	public snapshots = new Map();
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

	getSnapshot<Type>(selector: (store: Schema) => Type): Snapshot<Type> {
		if (this.snapshots.has(selector)) return this.snapshots.get(selector);

		const onPush = () => this.notifySubscribers();
		const snapshot = new Snapshot(selector(this.schema), onPush);

		this.snapshots.set(selector, snapshot);

		return snapshot;
	}

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const schema = options.schema({ document: createDocumentOf, collection: Collection.createCollectionOf });

		return new Store(schema);
	}
}
