import { Store } from "@nn/store";
import { describe, expect, it, vi } from "vitest";
import { getSnapshot } from "./getSnapshot";

describe("getSnapshot", () => {
	it("should return a snapshot", () => {
		const store = new Store({ test: [{ id: "1" }] });
		const selector = vi.fn((state) => state.test);
		const getSnapshotId = getSnapshot(selector, store);

		expect(getSnapshotId).toBeInstanceOf(Function);
		expect(getSnapshotId()).not.toBeUndefined();
		expect(selector).toHaveBeenCalledOnce();
	});
});
