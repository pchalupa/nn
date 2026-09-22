import { Collection } from "@nn/entities/Collection";
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
		const snapshot = snapshotManager.createSnapshot(id, new Collection());

		expect(snapshotManager.getSnapshot(id)).toBe(snapshot);
		expect(snapshot).toHaveProperty("state", new Collection());
		expect(snapshotManager).toMatchInlineSnapshot(`
			SnapshotManager {
			  "snapshots": WeakMap {},
			}
		`);
	});

	it("should get a snapshot", () => {
		const id = {};
		const snapshotManager = new SnapshotManager();
		const snapshot = snapshotManager.createSnapshot(id, new Collection());

		expect(snapshotManager.getSnapshot(id)).toBe(snapshot);
	});

	it("should invalidate a snapshot", () => {
		const id = {};
		const snapshotManager = new SnapshotManager();

		snapshotManager.createSnapshot(id, new Collection());
		snapshotManager.invalidateSnapshot(id);

		expect(snapshotManager.getSnapshot(id)).toBeUndefined();
	});
});
