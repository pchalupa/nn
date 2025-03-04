import type { Store } from "@nn/store";

export function subscribe<Schema extends object>(store: Store<Schema>) {
	return (listener: () => void) => {
		store.events.on("update", listener);

		return () => store.events.off("update", listener);
	};
}
