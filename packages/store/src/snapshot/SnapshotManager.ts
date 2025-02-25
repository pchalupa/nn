import { Snapshot } from "./Snapshot";
import { SnapshotDelegate } from "./SnapshotDelegate";

export class SnapshotManager {
	private snapshots = new Map<unknown, Snapshot>();

	private setSnapshot<Type>(id: unknown, snapshot: Snapshot<Type>) {
		this.snapshots.set(id, snapshot);
	}

	getSnapshot<Type>(id: unknown): Snapshot<Type> | undefined {
		return this.snapshots.get(id);
	}

	invalidateSnapshot(id: unknown) {
		this.snapshots.delete(id);
	}

	createSnapshot<Type>(id: unknown, data: Type): Snapshot<Type> {
		const snapshotDelegate = new SnapshotDelegate();
		const snapshot = new Snapshot(data);

		snapshot.delegate = snapshotDelegate;

		this.setSnapshot(id, snapshot);

		return snapshot;
	}
}
