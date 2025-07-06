import { EventEmitter } from "@nn/event-emitter";
import { MerkleTree } from "@nn/hash-tree";
import type { Repository } from "@nn/repository";
import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

export class Store<State extends object> {
	public events = new EventEmitter<{ update: [] }>();
	private snapshotManager = new SnapshotManager();

	constructor(
		private state: State,
		private repository?: Repository,
	) {
		// Attach event listeners to each entity in the state
		if (this.repository) {
			for (const [typeName, entity] of Object.entries(this.state)) {
				entity.events.on("update", (value: { id: string }) => this.repository?.set(value.id, value, typeName));
			}
		}

		// const values: string[] = this.state.tickets.map((ticket: Object) => {
		// 	return JSON.stringify(ticket);
		// });

		// const tree = MerkleTree.createMerkleTree(values).then((tree) => {
		// 	console.log(tree.root.hash);
		// });

		// console.log(tree.root?.hash);
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
