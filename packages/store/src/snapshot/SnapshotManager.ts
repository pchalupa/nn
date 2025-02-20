import { Snapshot } from "./Snapshot";

export class SnapshotManager {
	private snapshots = new Map<unknown, Snapshot>();

	getSnapshotById<Type>(id: unknown): Snapshot<Type> | undefined {
		return this.snapshots.get(id);
	}

	createSnapshot<Type>(id: unknown, data: Type, onPush: () => void): Snapshot<Type> {
		const snapshot = new Snapshot(data, onPush);

		this.snapshots.set(id, snapshot);

		return snapshot;
	}
}
