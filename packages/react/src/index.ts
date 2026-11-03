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

export function createStore<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	schema: StoreSchema,
): Store<StoreSchema> {
	return new Store(schema);
}

export function use<StoreSchema extends ObjectSchema<Record<string, Schema>>>(store: Store<StoreSchema>) {
	type Data = InferStateType<StoreSchema>;
	const getSnapshot = () => store.state.read();
	const subscribe = (observer: () => void) => store.updates.subscribe(observer);
	const update: Update<Data> = (recipe) => store.state.update(recipe);

	function useRead<Result>(selector: (data: Snapshot<Data>) => Result): Result {
		const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(value);

		return value;
	}

	function useUpdate(): Update<Data> {
		return update;
	}

	return { useRead, useUpdate };
}
