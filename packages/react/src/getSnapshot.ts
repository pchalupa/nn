import type { Store } from "@nn/store";
import type { Selector } from ".";

export function getSnapshot<Schema extends object>(selector: Selector<Schema>, store: Store<Schema>) {
	return () => JSON.stringify(selector(store.schema));
}
