import { EventEmitter } from "@nn/event-emitter";
import { InMemoryRepository } from "@nn/in-memory-repository";
import type { Repository } from "@nn/repository";
import { Collection } from "./Collection";
import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

type Options<Schema> = {
	schema: (entity: { collection: <Value extends { id: string }>() => Collection<Value> }) => Schema;
};

export class Store<State extends object> {
	public events = new EventEmitter<{ update: [] }>();
	private snapshotManager = new SnapshotManager();

	constructor(private state: State) {}

	getSnapshotOf<Type>(selector: (state: State) => Type): Snapshot<Type> {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot<Type>(snapshotId);

		if (!snapshot) {
			const data = selector(this.state);
			const onUpdate = () => {
				this.snapshotManager.invalidateSnapshot(snapshotId);
				this.events.emit("update");
			};

			snapshot = this.snapshotManager.createSnapshot(snapshotId, data);
			snapshot.events.once("update", onUpdate);
		}

		return snapshot;
	}

	static createWithOptions<Schema extends object>(options: Options<Schema>) {
		const ephemeral = new InMemoryRepository();

		const state = options.schema({
			collection: <Value extends { id: string }>() => {
				// TODO: Remove type casting
				const repository = ephemeral as Repository<Value>;
				const collection = new Collection<Value>([], repository);

				return collection;
			},
		});

		return new Store(state);
	}
}
