import { Snapshot } from "./Snapshot";

// TODO: Fix the type casting
export class SnapshotManager {
	private snapshots = new Map<string, Snapshot<unknown>>();

	createSnapshotOf<Type>(id: string, data: Type): Snapshot<Type> {
		const snapshot = Snapshot.createSnapshot(data);

		snapshot.on("invalidated", () => this.invalidateSnapshot(id));
		this.snapshots.set(id, snapshot as Snapshot<unknown>);

		return snapshot;
	}

	getSnapshot<Type>(id: string): Snapshot<Type> | undefined {
		return this.snapshots.get(id) as Snapshot<Type> | undefined;
	}

	invalidateSnapshot(id: string): void {
		this.snapshots.delete(id);
	}
}
