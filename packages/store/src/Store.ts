import { EventEmitter } from "@nn/event-emitter";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

export class Store<State extends object> {
	public events = new EventEmitter<{ update: [] }>();
	private snapshotManager = new SnapshotManager();

	constructor(
		private state: State,
		private repository?: Repository,
		private _remote?: Remote,
	) {
		// Attach event listeners to each entity in the state
		if (this.repository) {
			for (const [typeName, entity] of Object.entries(this.state)) {
				entity.events.on("update", (value: { id?: string }) => {
					if (value.id) {
						this.repository?.set(value.id, value, typeName);
					}
				});
			}
		}
	}

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
		return snapshot as Snapshot<Type> & Type;
	}
}
