import { Store } from "@nn/store";
import { describe, expect, it, vi } from "vitest";
import { getSnapshot } from "./getSnapshot";

describe("getSnapshot", () => {
	it("shout return a snapshot", () => {
		const store = new Store({ test: [{ id: "1" }] });
		const selector = vi.fn((state) => state.test);
		const snapshot = getSnapshot(selector, store)();

		expect(selector).toHaveBeenCalledOnce();
		expect(snapshot).toMatchInlineSnapshot(`"[object Object]"`);
	});
});
