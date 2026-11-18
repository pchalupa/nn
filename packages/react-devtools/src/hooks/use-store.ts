import type { Store } from "@nn/store";
import { useSyncExternalStore } from "react";

export function useStore(store: Store): unknown {
	const subscribe = (observer: () => void) => store.onChange(() => observer());
	const read = (): unknown => store.query((state) => state);

	return useSyncExternalStore(subscribe, read, read);
}
