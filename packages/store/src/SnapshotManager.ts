import { Snapshot } from "./Snapshot";

export class SnapshotManager {
	private snapshots = new Map<object, Snapshot<unknown>>();

	createSnapshot(id: object, state: unknown): Snapshot<unknown> {
		const snapshot = Snapshot.createSnapshot(state);

		snapshot.events.once("invalidated", () => this.invalidateSnapshot(id));
		this.snapshots.set(id, snapshot);

		return snapshot;
	}

	getSnapshot(id: object): Snapshot<unknown> | undefined {
		return this.snapshots.get(id);
	}

	invalidateSnapshot(id: object): void {
		this.snapshots.delete(id);
	}
}
