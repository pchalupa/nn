import { Store } from "@nn/store";
import { describe, expect, it, vi } from "vitest";
import { subscribe } from "./subscribe";

describe("subscribe", () => {
	it("should subscribe to store updates", () => {
		const store = new Store({});
		const listener = vi.fn();

		store.events.on = vi.fn();
		store.events.off = vi.fn();

		subscribe(store)(listener);

		expect(store.events.on).toHaveBeenCalledWith("update", listener);
	});

	it("should unsubscribe from store updates", () => {
		const store = new Store({});
		const listener = vi.fn();

		store.events.on = vi.fn();
		store.events.off = vi.fn();

		const unsubscribe = subscribe(store)(listener);

		unsubscribe();

		expect(store.events.off).toHaveBeenCalledWith("update", listener);
	});
});
