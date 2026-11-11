import type { Store } from "@nn/store";
import { useCallback, useSyncExternalStore } from "react";

export function useStore(store: Store): unknown {
	const subscribe = useCallback((observer: () => void) => store.onChange(() => observer()), [store]);
	const read = useCallback((): unknown => store.read(), [store]);
	const value = useSyncExternalStore(subscribe, read, read);

	return value;
}
