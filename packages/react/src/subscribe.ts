import type { Store } from "@nn/store";

export function subscribe<Schema extends object>(key: string, store: Store<Schema>) {
	return (listener: () => void) => {
		store.addSubscriber(key, listener);

		return () => store.removeSubscriber(key);
	};
}
