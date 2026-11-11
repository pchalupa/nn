import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";
import { Store } from "@nn/store";
import { useDebugValue } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { equal } from "./equal";

type Snapshot<Value> = {
	readonly [Key in keyof Value]: Snapshot<Value[Key]>;
};

type Update<Data> = (recipe: (draft: Data) => void) => void;

export function createStore<StoreSchema extends ObjectSchema<Record<string, Schema>>>(schema: StoreSchema) {
	type Data = InferStateType<StoreSchema>;

	const store = new Store(schema);

	const getSnapshot = () => store.read();
	const subscribe = (listener: () => void) => store.onChange(listener);
	const update: Update<Data> = (recipe) => store.update(recipe);

	function useRead<Result>(selector: (data: Snapshot<Data>) => Result): Result {
		const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(value);

		return value;
	}

	function useUpdate(): Update<Data> {
		return update;
	}

	return { store, useRead, useUpdate };
}
