import { Snapshot } from "./Snapshot";

type StateSnapshot<State> = Snapshot<State> & State;

export class SnapshotManager {
	private snapshots = new WeakMap<object, Snapshot<unknown>>();

	createSnapshot<State>(id: object, state: State) {
		const snapshot = Snapshot.createSnapshot(state);
		const handleInvalidated = () => this.invalidateSnapshot(id);

		snapshot.events.once("invalidated", handleInvalidated);
		this.snapshots.set(id, snapshot);

		return snapshot as StateSnapshot<State>;
	}

	getSnapshot<State>(id: object) {
		// TODO: Fix the type casting
		return this.snapshots.get(id) as StateSnapshot<State> | undefined;
	}

	invalidateSnapshot(id: object): void {
		this.snapshots.delete(id);
	}
}
