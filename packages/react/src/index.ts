import { Store } from "@nn/store";
import { useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

export function use<Schema extends object>(store: Store<Schema>) {
	return function useStore<Type>(selector: Selector<Schema, Type>) {
		const selectorFn = useRef(selector);
		const subscribeFn = useRef(subscribe(Math.random().toString(), store));
		const getSnapshotFn = useRef(getSnapshot(selectorFn.current, store));

		// TODO: get snapshot key here
		useSyncExternalStore(subscribeFn.current, getSnapshotFn.current);

		return store.getSnapshotOf<Type>(selectorFn.current);
	};
}
