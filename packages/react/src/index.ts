import type { RepositoryFactory } from "@nn/repository";
import { Store } from "@nn/store";
import { Collection } from "@nn/store/collection";
import { useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export function collection<Type extends { id: string }>(): (data: Type[]) => Collection<Type> {
	return (data: Type[]) => new Collection<Type>(data);
}

// biome-ignore lint/suspicious/noExplicitAny: testing
type Entity = Collection<any>;
// biome-ignore lint/suspicious/noExplicitAny: testing
type EntityFactory = (data: any[]) => Entity;

export async function createStore<
	Schema extends Record<string, EntityFactory>,
	State extends Record<string, unknown> = { [Key in keyof Schema]: ReturnType<Schema[Key]> },
>(options: {
	schema: Schema;
	repository: RepositoryFactory;
}): Promise<Store<State>> {
	const { schema, repository: repositoryFactory } = options;
	const typeNames = Object.keys(schema);
	const repository = await repositoryFactory.createRepository(typeNames);
	const state: Record<string, Entity> = {};

	for await (const [typeName, entityFactory] of Object.entries(schema)) {
		const data = await repository.getAll<Schema[typeof typeName]>(typeName);

		state[typeName] = entityFactory(data);
		state[typeName].events.on("update", (value: { id: string }) => repository.set(value.id, value, typeName));
	}

	const store = new Store(state as State, repository);

	return store;
}

export function use<Schema extends object>(promisedStore: Promise<Store<Schema>>) {
	return function useStore<Type>(selector: Selector<Schema, Type>) {
		const store = usePromise(promisedStore);
		const selectorRef = useRef(selector);
		const subscribeRef = useRef(subscribe(store));
		const getSnapshotRef = useRef(getSnapshot(selectorRef.current, store));
		const snapshot = store.getSnapshotOf<Type>(selectorRef.current);

		// TODO: get snapshot id here
		// TODO: Add server get snapshot
		useSyncExternalStore(subscribeRef.current, getSnapshotRef.current);
		useDebugValue(snapshot);

		return snapshot;
	};
}
