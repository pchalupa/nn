import { Snapshot } from "./Snapshot";

export class SnapshotManager {
	private snapshots = new WeakMap<object, Snapshot<unknown>>();

	createSnapshot<State>(id: object, state: State): Snapshot<State> {
		const snapshot = Snapshot.createSnapshot(state);

		this.snapshots.set(id, snapshot);

		return snapshot;
	}

	getSnapshot<State>(id: object): Snapshot<State> | undefined {
		// TODO: Fix the type casting
		return this.snapshots.get(id) as Snapshot<State> | undefined;
	}

	invalidateSnapshot(id: object): void {
		this.snapshots.delete(id);
	}
}
