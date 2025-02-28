import { Store } from "@nn/store";
import { useDebugValue, useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

export function use<Schema extends object>(store: Store<Schema>) {
	return function useStore<Type>(selector: Selector<Schema, Type>) {
		const selectorFn = useRef(selector);
		const subscribeFn = useRef(subscribe(Math.random().toString(), store));
		const getSnapshotFn = useRef(getSnapshot(selectorFn.current, store));

		// TODO: get snapshot id here
		useSyncExternalStore(subscribeFn.current, getSnapshotFn.current);

		const snapshot = store.getSnapshotOf<Type>(selectorFn.current);

		useDebugValue(snapshot);

		return snapshot;
	};
}
