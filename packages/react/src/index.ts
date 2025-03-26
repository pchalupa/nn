import { Store } from "@nn/store";
import { useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

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
