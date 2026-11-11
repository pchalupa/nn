import { object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStore } from "./use-store";

describe("useStore", () => {
	const schema = object({ language: string() });

	it("reads the current snapshot and follows updates", () => {
		const store = new Store(schema);

		store.update((draft) => {
			draft.language = "en";
		});

		const { result } = renderHook(() => useStore(store));

		expect(result.current).toStrictEqual({ language: "en" });

		act(() => {
			store.update((draft) => {
				draft.language = "cs";
			});
		});

		expect(result.current).toStrictEqual({ language: "cs" });
	});

	it("unsubscribes on unmount", () => {
		const store = new Store(schema);
		const unsubscribe = vi.fn();

		vi.spyOn(store, "onChange").mockReturnValue(unsubscribe);

		const { unmount } = renderHook(() => useStore(store));

		expect(unsubscribe).not.toHaveBeenCalled();

		unmount();

		expect(unsubscribe).toHaveBeenCalledOnce();
	});
});
