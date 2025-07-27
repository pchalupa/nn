import type { Remote } from "@nn/remote";
import { Store } from "@nn/store";
import { useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

// biome-ignore lint/suspicious/noExplicitAny: testing
type EntityFactory = (data: any) => unknown;

type Repository = ConstructorParameters<typeof Store>[1];
type RepositoryFactory = {
	createRepository: (typeNames: string[]) => Promise<Repository>;
};

export async function createStore<
	Schema extends Record<string, EntityFactory>,
	State extends Record<string, unknown> = { [Key in keyof Schema]: ReturnType<Schema[Key]> },
>(options: { schema: Schema; repository?: RepositoryFactory; remote?: Remote }): Promise<Store<State>> {
	const { schema, repository: repositoryFactory, remote } = options;
	const typeNames = Object.keys(schema);
	const repository = await repositoryFactory?.createRepository(typeNames);
	const state: Record<string, unknown> = {};

	for await (const [typeName, entityFactory] of Object.entries(schema)) {
		const data = await repository?.getAll<Schema[typeof typeName]>(typeName);

		state[typeName] = entityFactory(data);
	}

	const store = new Store(state as State, repository, remote);

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
