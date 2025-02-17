import { Collection } from "./Collection";
import { Store } from "./Store";
import { Subscribers } from "./Subscribers";

type Entities = { document: <Type>() => Type; collection: <Type>() => Collection<Type> };
type Schema<S> = (entity: Entities) => S;
type Options<S> = { schema: Schema<S> };

export function createStore<S extends object>(options: Options<S>) {
	const schema = options.schema({ document, collection });
	const subscribers = new Subscribers();
	const store = new Store(schema, subscribers);

	return store;
}

export type { Store } from "./Store";

function collection<Type>(): Type[] {
	return new Collection<Type>();
}

function document<Type>(): Type {
	return {} as Type;
}
