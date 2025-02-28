import { Snapshot } from "./Snapshot";

type Id = Function;

// TODO: Fix the type casting
export class SnapshotManager {
	private snapshots = new WeakMap<Id, Snapshot<unknown>>();

	createSnapshot<Type>(id: Id, state: Type): Snapshot<Type> {
		const snapshot = Snapshot.createSnapshot(state);

		snapshot.on("invalidated", () => this.invalidateSnapshot(id));

		this.snapshots.set(id, snapshot as Snapshot<unknown>);

		return snapshot;
	}

	getSnapshot<State>(id: Id): Snapshot<State> {
		return this.snapshots.get(id) as Snapshot<State> | undefined;
	}

	invalidateSnapshot(id: Id): void {
		this.snapshots.delete(id);
	}
}
