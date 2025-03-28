import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { SnapshotManager } from "./SnapshotManager";

export class Store<State extends object> {
	public events = new EventEmitter<{ update: [] }>();
	private snapshotManager = new SnapshotManager();

	constructor(
		private state: State,
		private repository?: Repository,
	) {}

	getSnapshotOf<Type>(selector: (state: State) => Type) {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot(snapshotId);

		if (!snapshot) {
			const state = selector(this.state);
			const handleInvalidated = () => this.events.emit("update");

			snapshot = this.snapshotManager.createSnapshot(snapshotId, state);
			snapshot.events.once("invalidated", handleInvalidated);
		}

		// TODO: Remove type casting
		return snapshot as Type;
	}
}
