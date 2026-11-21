import { useSyncExternalStore } from "react";

import type { Inspectable } from "../inspectable";

export function useStore(store: Inspectable): unknown {
	const subscribe = (observer: () => void) => store.onChange(() => observer());
	const read = (): unknown => store.query((state) => state);

	return useSyncExternalStore(subscribe, read, read);
}
