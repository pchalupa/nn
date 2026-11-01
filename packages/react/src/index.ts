import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";
import { Store } from "@nn/store";
import { useCallback, useDebugValue, use as usePromise } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { equal } from "./equal";

type Snapshot<Value> = {
	readonly [Key in keyof Value]: Snapshot<Value[Key]>;
};

type Update<Data> = (recipe: (draft: Data) => void) => void;

export const createStore = Store.fromSchema;

export function use<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	promisedStore: Promise<Store<StoreSchema>>,
) {
	type Data = InferStateType<StoreSchema>;

	function useRead<Result>(selector: (data: Snapshot<Data>) => Result): Result {
		const store = usePromise(promisedStore);

		const getSnapshot = useCallback(() => store.state.read(), [store]);
		const subscribe = useCallback((observer: () => void) => store.subscribe(observer), [store]);

		const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(value);

		return value;
	}

	function useUpdate(): Update<Data> {
		const store = usePromise(promisedStore);

		return useCallback<Update<Data>>((recipe) => store.state.update(recipe), [store]);
	}

	return { useRead, useUpdate };
}
