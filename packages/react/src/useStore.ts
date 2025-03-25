import type { Store } from "@nn/store";
import { use, useDebugValue, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export function useStore<Schema extends object, Type>(
	promisedStore: Promise<Store<Schema>>,
	selector: Selector<Schema, Type>,
) {
	const store = use(promisedStore);
	const selectorRef = useRef(selector);
	const subscribeRef = useRef(subscribe(store));
	const getSnapshotRef = useRef(getSnapshot(selectorRef.current, store));
	const snapshot = store.getSnapshotOf<Type>(selectorRef.current);

	// TODO: get snapshot id here
	// TODO: Add server get snapshot
	useSyncExternalStore(subscribeRef.current, getSnapshotRef.current);
	useDebugValue(snapshot);

	return snapshot;
}
