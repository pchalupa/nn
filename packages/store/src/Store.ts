import { Collection } from "./Collection";
import { createDocumentOf } from "./Document";
import { Subscribers } from "./Subscribers";

type Options<SchemaType> = { schema: Schema<SchemaType> };
type Schema<Type> = (entity: Entities) => Type;
type Entities = { document: typeof createDocumentOf; collection: typeof Collection.createCollectionOf };

export class Store<Schema extends object> {
	constructor(
		private _schema: Schema,
		private subscribers: Subscribers,
	) {}

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
		this.subscribers.forEach((listener) => listener());
	}

	getSnapshot<Type>(selector: (store: Schema) => Type): Type {
		return selector(this.schema);
	}

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const schema = options.schema({ document: createDocumentOf, collection: Collection.createCollectionOf });
		const subscribers = new Subscribers();

		return new Store(schema, subscribers);
	}
}
