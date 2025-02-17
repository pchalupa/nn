import { Store } from "@nn/store";
import { useRef, useSyncExternalStore } from "react";
import { getSnapshot } from "./getSnapshot";
import { subscribe } from "./subscribe";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

export function use<Schema extends object>(store: Store<Schema>) {
	const createArrayProxy = (data: object) =>
		new Proxy(data, {
			set(target, prop, value) {
				// target[prop] = value;
				store.schema.tickets = [...store.schema.tickets, value];

				// target = [...target, value];
				// Reflect.set(target, prop, value);
				if (prop === "length" && Array.isArray(target)) {
					// subscribers.get(key)?.();
					store.notifySubscribers();
				}
				return true;
			},
		});

	return function useStore<T>(selector: Selector<Schema, T>): T {
		const subscribeFn = useRef(subscribe(Math.random().toString(), store));
		const getSnapshotFn = useRef(getSnapshot(selector, store));

		const data: string = useSyncExternalStore(subscribeFn.current, getSnapshotFn.current);
		const snap = JSON.parse(data);

		if (Array.isArray(snap)) return createArrayProxy(snap);

		return snap;
	};
}
