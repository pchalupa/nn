import type { Entity } from "@nn/entities/Entity";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { ObjectSchema, Schema } from "@nn/schema";
import { type Recipe, type SelectCache, type Selector, Store } from "@nn/store";
import { useCallback, useDebugValue, use as usePromise, useRef, useSyncExternalStore } from "react";

type Update<Selected> = (recipe: Recipe<Selected>) => void;

export async function createStore<StoreSchema extends ObjectSchema<Record<string, Schema>>>(options: {
	schema: StoreSchema;
	repository?: Repository;
	remote?: Remote;
}) {
	return Store.fromSchema(options);
}

export function use<State extends Record<string, Entity>>(promisedStore: Promise<Store<State>>) {
	return function useStore<Selected>(selector: Selector<State, Selected>): readonly [Selected, Update<Selected>] {
		const store = usePromise(promisedStore);
		const cache = useRef<SelectCache<Selected>>({});

		const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);

		const getSnapshot = useCallback(() => store.select(selector, cache.current), [store, selector]);

		const update = useCallback<Update<Selected>>((recipe) => store.update(selector, recipe), [store, selector]);

		const view = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

		useDebugValue(view);

		return [view, update];
	};
}
