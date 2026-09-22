import type { Observable } from "@nn/event-emitter/Observable";

import { Snapshot } from "./Snapshot";

export class SnapshotManager {
	private snapshots = new WeakMap<object, Snapshot>();

	createSnapshot(id: object, state: Observable): Snapshot {
		const snapshot = new Snapshot(state);

		snapshot.events.once("invalidated", () => this.invalidateSnapshot(id));
		this.snapshots.set(id, snapshot);

		return snapshot;
	}

	getSnapshot(id: object): Snapshot | undefined {
		return this.snapshots.get(id);
	}

	invalidateSnapshot(id: object): void {
		this.snapshots.delete(id);
	}
}
