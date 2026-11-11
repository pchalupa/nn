// @vitest-environment jsdom
import { object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStore } from "./use-store";

describe("useStore", () => {
	const schema = object({ language: string() });

	it("reads the current snapshot on mount", () => {
		const store = new Store(schema);

		store.update((draft) => {
			draft.language = "en";
		});

		const { result } = renderHook(() => useStore(store));

		expect(result.current).toStrictEqual({ language: "en" });
	});

	it("updates the snapshot when the store changes", () => {
		const store = new Store(schema);
		const { result } = renderHook(() => useStore(store));

		act(() => {
			store.update((draft) => {
				draft.language = "cs";
			});
		});

		expect(result.current).toStrictEqual({ language: "cs" });
	});
});
