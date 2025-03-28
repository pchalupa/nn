import type { RepositoryFactory } from "@nn/repository";
import { Store } from "@nn/store";
import { Collection } from "@nn/store/collection";
import { useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

type Foo = ConstructorParameters<typeof Store>;

export function collection<Type extends { id: string }>(): Collection<Type> {
	return (data: Type[]) => new Collection<Type>(data);
}

export async function createStore<Schema extends object>(options: {
	schema: Schema;
	repository: RepositoryFactory;
}): Promise<Store<Schema>> {
	const { schema, repository: repositoryFactory } = options;
	const typeNames = Object.keys(schema);
	const repository = await repositoryFactory.createRepository(typeNames);

	for await (const id of typeNames) {
		const data = await repository.getAll(id);
		const entity = schema[id](data);

		entity.events.on("update", (value) => {
			repository.set(value.id, value, id);
		});

		schema[id] = entity;
	}

	const store = new Store<Schema>(schema, repository);

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
