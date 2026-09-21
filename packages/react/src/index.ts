import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { Observable } from "@nn/event-emitter/Observable";
import type { ObjectSchema, Schema } from "@nn/schema";
import { Store } from "@nn/store";
import { useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";

import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Snapshot extends Observable = Observable> = (store: Schema) => Snapshot;

export async function createStore<StoreSChema extends ObjectSchema<Record<string, Schema>>>(options: {
	schema: StoreSChema;
	repository?: Repository;
	remote?: Remote;
}) {
	return Store.fromSchema(options);
}

export function use<Schema extends object>(promisedStore: Promise<Store<Schema>>) {
	return function useStore<Type extends Observable>(selector: Selector<Schema, Type>) {
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
