import { Snapshot } from "./Snapshot";

type Id = Function;

// TODO: Fix the type casting
export class SnapshotManager {
	private snapshots = new WeakMap<Id, Snapshot<unknown>>();

	createSnapshot<State>(id: Id, state: State): Snapshot<State> {
		const snapshot = Snapshot.createSnapshot(state);

		this.snapshots.set(id, snapshot);

		return snapshot;
	}

	getSnapshot<State>(id: Id): Snapshot<State> {
		return this.snapshots.get(id) as Snapshot<State> | undefined;
	}

	invalidateSnapshot(id: Id): void {
		this.snapshots.delete(id);
	}
}
