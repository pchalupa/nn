import { describe, expect, it } from "vitest";
import { SnapshotRegistry } from "./SnapshotRegistry";

describe("SnapshotRegistry", () => {
	it("should create an instance of snapshot manager", () => {
		const snapshotRegistry = new SnapshotRegistry();

		expect(snapshotRegistry).toHaveProperty("snapshots");
		expect(snapshotRegistry).toHaveProperty("createSnapshot");
		expect(snapshotRegistry).toHaveProperty("getSnapshot");
		expect(snapshotRegistry).toHaveProperty("invalidateSnapshot");
		expect(snapshotRegistry).toMatchInlineSnapshot(`
			SnapshotRegistry {
			  "snapshots": WeakMap {},
			}
		`);
	});

	it("should create a snapshot", () => {
		const id = {};
		const snapshotRegistry = new SnapshotRegistry();
		const snapshot = snapshotRegistry.createSnapshot(id, {});

		expect(snapshotRegistry.getSnapshot(id)).toBe(snapshot);
		expect(snapshot).toHaveProperty("state", {});
		expect(snapshotRegistry).toMatchInlineSnapshot(`
			SnapshotRegistry {
			  "snapshots": WeakMap {},
			}
		`);
	});

	it("should get a snapshot", () => {
		const id = {};
		const snapshotRegistry = new SnapshotRegistry();
		const snapshot = snapshotRegistry.createSnapshot(id, {});

		expect(snapshotRegistry.getSnapshot(id)).toBe(snapshot);
	});

	it("should invalidate a snapshot", () => {
		const id = {};
		const snapshotRegistry = new SnapshotRegistry();

		snapshotRegistry.createSnapshot(id, {});
		snapshotRegistry.invalidateSnapshot(id);

		expect(snapshotRegistry.getSnapshot(id)).toBeUndefined();
	});
});
