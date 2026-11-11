import type { Store } from "@nn/store";
import { useSyncExternalStore } from "react";

export function useStore(store: Store): unknown {
	const subscribe = (observer: () => void) => store.onChange(() => observer());
	const read = (): unknown => store.read();

	return useSyncExternalStore(subscribe, read, read);
}
