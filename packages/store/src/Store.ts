import { Collection } from "@nn/entities/Collection";
import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { ArraySchema, Infer, ObjectSchema, Schema } from "@nn/schema";

import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

type StateFromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>> = {
	[Key in keyof StoreSchema["properties"]]: StoreSchema["properties"][Key] extends ArraySchema<infer Item>
		? Collection<Infer<Item> & { id: string }>
		: never;
};

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

	static async fromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>>(options: {
		schema: StoreSchema;
		repository?: Repository;
		remote?: Remote;
	}): Promise<Store<StateFromSchema<StoreSchema>>> {
		const { schema, repository, remote } = options;
		const state: Record<string, Collection<{ id: string }>> = {};

		await repository?.init(schema.properties);

		for (const [typeName, shape] of Object.entries(schema.properties)) {
			if (shape.type !== "array") {
				throw new TypeError(`Unsupported top-level schema shape "${shape.type}" for "${typeName}".`);
			}

			const data = await repository?.getAll<{ id: string }>(typeName);

			state[typeName] = new Collection(data);
		}

		return new Store(state as StateFromSchema<StoreSchema>, repository, remote);
	}

	getSnapshotOf<SelectedState extends Observable>(selector: (state: State) => SelectedState): SelectedState {
		// TDB: Remove type casting
		return this.snapshotOf(selector).state as SelectedState;
	}

	getSnapshotIdOf<SelectedState extends Observable>(selector: (state: State) => SelectedState): string | undefined {
		return this.snapshotOf(selector).id;
	}

	private snapshotOf<SelectedState extends Observable>(selector: (state: State) => SelectedState): Snapshot {
		const snapshotId = selector;
		let snapshot = this.snapshotManager.getSnapshot(snapshotId);

		if (!snapshot) {
			const state = selector(this.state);
			const handleInvalidated = () => this.events.emit("update");

			snapshot = this.snapshotManager.createSnapshot(snapshotId, state);
			snapshot.events.once("invalidated", handleInvalidated);
		}

		return snapshot;
	}
}
