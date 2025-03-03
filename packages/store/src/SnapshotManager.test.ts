import { describe, expect, it } from "vitest";
import { SnapshotManager } from "./SnapshotManager";

describe("SnapshotManager", () => {
	it("should create an instance of snapshot manager", () => {
		const snapshotManager = new SnapshotManager();

		expect(snapshotManager).toHaveProperty("snapshots");
		expect(snapshotManager).toHaveProperty("createSnapshot");
		expect(snapshotManager).toHaveProperty("getSnapshot");
		expect(snapshotManager).toHaveProperty("invalidateSnapshot");
		expect(snapshotManager).toMatchInlineSnapshot(`
			SnapshotManager {
			  "snapshots": WeakMap {},
			}
		`);
	});

	it("should create a snapshot", () => {
		const id = {};
		const snapshotManager = new SnapshotManager();
		const snapshot = snapshotManager.createSnapshot(id, {});

		expect(snapshotManager.getSnapshot(id)).toBe(snapshot);
		expect(snapshot).toHaveProperty("data", {});
		expect(snapshotManager).toMatchInlineSnapshot(`
			SnapshotManager {
			  "snapshots": Map {
			    "test" => {
			      "data": {},
			      "events": Map {
			        "invalidated" => Set {
			          [Function],
			        },
			      },
			    },
			  },
			}
		`);
	});

	it("should get a snapshot", () => {
		const id = {};
		const snapshotManager = new SnapshotManager();
		const snapshot = snapshotManager.createSnapshot(id, {});

		expect(snapshotManager.getSnapshot(id)).toBe(snapshot);
	});

	it("should invalidate a snapshot", () => {
		const id = {};
		const snapshotManager = new SnapshotManager();

		snapshotManager.createSnapshot(id, {});
		snapshotManager.invalidateSnapshot(id);

		expect(snapshotManager.getSnapshot(id)).toBeUndefined();
	});
});
