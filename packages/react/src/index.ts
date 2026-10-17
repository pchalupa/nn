import { type Path, type PathDraft, type PathValue, type Recipe, Store } from "@nn/store";
import { useCallback, useDebugValue, use as usePromise, useSyncExternalStore } from "react";

type Update<Drafted> = (recipe: Recipe<Drafted>) => void;

export const createStore = Store.fromSchema;

export function use<Data extends Record<string, unknown>>(promisedStore: Promise<Store<Data>>) {
	return function useStore<const Segments extends Path<Data>>(
		...path: Segments
	): [PathValue<Data, Segments>, Update<PathDraft<Data, Segments>>] {
		const store = usePromise(promisedStore);

		const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
		const getSnapshot = useCallback(() => store.read(path), [store, path]);
		const getServerSnapshot = useCallback(() => store.read(path), [store, path]);
		const update = useCallback<Update<PathDraft<Data, Segments>>>(
			(recipe) => store.update(path, recipe),
			[store, path],
		);

		const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

		useDebugValue(view);

		return [view, update];
	};
}
