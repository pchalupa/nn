import { Collection } from "./Collection";
import { Store } from "./Store";
import { Subscribers } from "./Subscribers";

type Schema<Type> = (entity: Entities) => Type;
type Options<SchemaType> = { schema: Schema<SchemaType> };

export function createStore<S extends object>(options: Options<S>) {
	const schema = options.schema({ document, collection });
	const subscribers = new Subscribers();
	const store = new Store(schema, subscribers);

	return store;
}

export type { Store } from "./Store";

type Entities = { document: typeof document; collection: typeof collection };

function collection<Type>(): Type[] {
	return new Collection<Type>();
}

function document<Type>(): Type {
	return {} as Type;
}
