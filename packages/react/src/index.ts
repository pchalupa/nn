import { Store } from "@nn/store";
import { useStore } from "./useStore";

export type Selector<Schema, Slice = unknown> = (store: Schema) => Slice;

export const createStore = Store.createWithOptions;

export function use<Schema extends object>(store: Promise<Store<Schema>>) {
	return useStore.bind(null, store);
}
