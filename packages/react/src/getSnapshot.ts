import type { Store } from "@nn/store";
import type { Selector } from ".";

export function getSnapshot<Schema extends object>(
	selector: Selector<Schema>,
	store: Store<Schema>,
): () => string | undefined {
	return () => store.getSnapshotOf<ReturnType<Selector<Schema>>>(selector)?.id;
}
