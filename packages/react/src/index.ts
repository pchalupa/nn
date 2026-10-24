import type { InferStateType, ObjectSchema, Schema } from "@nn/schema";
import { Store } from "@nn/store";
import { useCallback, useDebugValue, use as usePromise } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { equal } from "./equal";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

type Update<Data> = (recipe: (draft: Data) => void) => void;

export const createStore = Store.fromSchema;

export function use<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	promisedStore: Promise<Store<StoreSchema>>,
) {
	type Data = InferStateType<StoreSchema>;

	return function useStore<Result>(selector: (data: ReadonlyData<Data>) => Result): [Result, Update<Data>] {
		const store = usePromise(promisedStore);

		const getSnapshot = useCallback(() => store.state.read(), [store]);
		const subscribe = useCallback((listener: () => void) => store.state.subscribe(listener), [store]);
		const update = useCallback<Update<Data>>((recipe) => store.state.update(recipe), [store]);

		const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(value);

		return [value, update];
	};
}
