import { describe, expect, it } from "vitest";
import { SnapshotManager } from "./SnapshotManager";

describe("SnapshotManager", () => {
	it("should create an instance of snapshot manager", () => {
		const snapshotManager = new SnapshotManager();

		expect(snapshotManager).toHaveProperty("snapshots");
		expect(snapshotManager).toHaveProperty("createSnapshotOf");
		expect(snapshotManager).toHaveProperty("getSnapshot");
		expect(snapshotManager).toHaveProperty("invalidateSnapshot");
		expect(snapshotManager).toMatchInlineSnapshot(`
			SnapshotManager {
			  "snapshots": Map {},
			}
		`);
	});

	it("should create a snapshot", () => {
		const snapshotManager = new SnapshotManager();
		const snapshot = snapshotManager.createSnapshotOf("test", {});

		expect(snapshotManager.getSnapshot("test")).toBe(snapshot);
		expect(snapshot).toHaveProperty("data", {});
		expect(snapshotManager).toMatchInlineSnapshot(`
			SnapshotManager {
			  "snapshots": Map {
			    "test" => {
			      "data": {},
			      "invalidatedAt": undefined,
			      "onInvalidate": undefined,
			      "onPush": undefined,
			    },
			  },
			}
		`);
	});

	it("should get a snapshot", () => {
		const snapshotManager = new SnapshotManager();
		const snapshot = snapshotManager.createSnapshotOf("test", {});

		expect(snapshotManager.getSnapshot("test")).toBe(snapshot);
	});

	it("should invalidate a snapshot", () => {
		const snapshotManager = new SnapshotManager();

		snapshotManager.createSnapshotOf("test", {});
		snapshotManager.invalidateSnapshot("test");

		expect(snapshotManager.getSnapshot("test")).toBeUndefined();
	});
});
