import type { ObjectSchema, Schema } from "@nn/schema";
import { type DataFromSchema, type Path, type PathValue, Store, type Update } from "@nn/store";
import { useCallback, useDebugValue, use as usePromise, useSyncExternalStore } from "react";

export const createStore = Store.fromSchema;

export function use<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	promisedStore: Promise<Store<StoreSchema>>,
) {
	type Data = DataFromSchema<StoreSchema>;

	return function useStore<const Segments extends readonly string[] & Path<Data>>(
		...path: Segments
	): [PathValue<Data, Segments>, Update<Data, Segments>] {
		const store = usePromise(promisedStore);

		const subscribe = useCallback((listener: () => void) => store.state.subscribe(listener), [store]);
		const getSnapshot = useCallback(() => store.state.read(path), [store, path]);
		const getServerSnapshot = useCallback(() => store.state.read(path), [store, path]);
		const update = useCallback<Update<Data, Segments>>((input) => store.state.update(path, input), [store, path]);

		const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

		useDebugValue(view);

		return [view, update];
	};
}
