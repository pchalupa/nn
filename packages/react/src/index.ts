import { Store } from "@nn/store";
import { useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

export function use<Schema extends object>(store: Store<Schema>) {
	return function useStore<T>(selector: Selector<Schema, T>): T {
		const selectorFn = useRef(selector);
		const subscribeFn = useRef(subscribe(Math.random().toString(), store));
		const getSnapshotFn = useRef(getSnapshot(selectorFn.current, store));

		useSyncExternalStore(subscribeFn.current, getSnapshotFn.current);

		return store.snapshots.get(selectorFn.current);
	};
}
