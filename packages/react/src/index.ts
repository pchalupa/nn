import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";
import type { Store } from "@nn/store";
import { useDebugValue } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { equal } from "./equal";

type Snapshot<Value> = {
	readonly [Key in keyof Value]: Snapshot<Value[Key]>;
};

type Update<Data> = (recipe: (draft: Data) => void) => void;

export function use<StoreSchema extends ObjectSchema<Record<string, Schema>>>(store: Store<StoreSchema>) {
	type Data = InferStateType<StoreSchema>;

	function useRead<Result>(selector: (data: Snapshot<Data>) => Result): Result {
		const getSnapshot = () => store.state.read();
		const subscribe = (observer: () => void) => store.subscribe(observer);

		const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(value);

		return value;
	}

	function useUpdate(): Update<Data> {
		const update: Update<Data> = (recipe) => store.state.update(recipe);

		return update;
	}

	return { useRead, useUpdate };
}
