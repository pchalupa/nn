import { object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useStore } from "./use-store";

describe("useStore", () => {
	const schema = object({ language: string() });

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
