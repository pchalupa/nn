import type { InferStateType, Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";
import { Store } from "@nn/store";
import { useDebugValue } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { equal } from "./equal";

type ReadonlyData<Value> = {
	readonly [Key in keyof Value]: ReadonlyData<Value[Key]>;
};

type Mutate<Data> = (recipe: (draft: Data) => void) => void;

export interface ReactStore<StoreSchema extends ObjectSchema<Record<string, Schema>>> {
	store: Store<StoreSchema>;
	/**
	 * Re-renders when the selected result changes.
	 *
	 * @example
	 * const openTickets = useQuery((state) => state.tickets.filter((ticket) => ticket.status !== "done"));
	 */
	useQuery<Result>(selector: (data: ReadonlyData<InferStateType<StoreSchema>>) => Result): Result;
	/**
	 * Returns a stable `Store.mutate`.
	 *
	 * @example
	 * const mutate = useMutation();
	 *
	 * mutate((state) => {
	 * 	state.language = "cs";
	 * });
	 */
	useMutation(): Mutate<InferStateType<StoreSchema>>;
}

/**
 * Creates a `Store` with hooks bound to it. Call it once at module level.
 *
 * @example
 * export const { store, useQuery, useMutation } = createStore(schema);
 *
 * new IndexDbSync(store, "my-app").connect();
 */
export function createStore<StoreSchema extends ObjectSchema<Record<string, Schema>>>(
	schema: StoreSchema,
): ReactStore<StoreSchema> {
	type Data = InferStateType<StoreSchema>;

	const store = new Store(schema);

	// TODO: Query whole store data. Strive for selected data only.
	const getSnapshot = () => store.query((data) => data);
	const subscribe = (listener: () => void) => store.onChange(listener);
	const mutate: Mutate<Data> = (recipe) => store.mutate(recipe);

	function useQuery<Result>(selector: (data: ReadonlyData<Data>) => Result): Result {
		// TODO: Aim for plain useSyncExternalStore hook.
		const result = useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, equal);

		useDebugValue(result);

		return result;
	}

	function useMutation(): Mutate<Data> {
		return mutate;
	}

	return { store, useQuery, useMutation };
}
