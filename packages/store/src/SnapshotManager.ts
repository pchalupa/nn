import { Snapshot } from "./Snapshot";

export class SnapshotManager {
	private snapshots = new WeakMap<object, Snapshot<unknown>>();

	createSnapshot(id: object, state: unknown): Snapshot<unknown> {
		const snapshot = Snapshot.createSnapshot(state);
		const handleInvalidated = () => this.invalidateSnapshot(id);

		snapshot.events.once("invalidated", handleInvalidated);
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
