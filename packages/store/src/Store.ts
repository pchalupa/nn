import { Collection } from "@nn/entities/Collection";
import { LWWRegister } from "@nn/entities/LWWRegister";
import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { ArraySchema, Infer, ObjectSchema, Schema } from "@nn/schema";

import type { Snapshot } from "./Snapshot";
import { SnapshotManager } from "./SnapshotManager";

// TODO: This needs attention
type StateFromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>> = {
	[Key in keyof StoreSchema["properties"]]: StoreSchema["properties"][Key] extends ArraySchema<infer Item>
		? Collection<Infer<Item> & { id: string }>
		: Infer<StoreSchema["properties"][Key]> extends string
			? LWWRegister<Infer<StoreSchema["properties"][Key]> | undefined>
			: never;
};

export class Store<State extends object> {
	public events = new EventEmitter<{ update: []; error: [Error] }>();
	private snapshotManager = new SnapshotManager();

	constructor(
		private state: State,
		private repository?: Repository,
		_remote?: Remote,
	) {
		// Attach event listeners to each entity in the state
		if (this.repository) {
			for (const [typeName, entity] of Object.entries(this.state)) {
				if (entity instanceof Collection) {
					entity.events.on("update", (value: { id?: string }) => {
						if (value.id) {
							this.repository?.set(value.id, value, typeName).catch((error) => {
								if (error instanceof Error) this.events.emit("error", error);
							});
						}
					});
					// TBD: This branch will be eventually default one once collection will be aligned with subscribe method
				} else if (entity instanceof LWWRegister) {
					const id = typeName;
					entity.subscribe(() => {
						this.repository?.set(id, entity.current, typeName).catch((error) => {
							if (error instanceof Error) this.events.emit("error", error);
						});
					});
				}
			}
		}
	}

	static async fromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>>(options: {
		schema: StoreSchema;
		repository?: Repository;
		remote?: Remote;
	}): Promise<Store<StateFromSchema<StoreSchema>>> {
		const { schema, repository, remote } = options;
		const state: Record<string, Collection<{ id: string }> | LWWRegister<string | undefined>> = {};

		await repository?.init(schema.properties);

		for (const [typeName, shape] of Object.entries(schema.properties)) {
			if (shape.type === "array") {
				const data = await repository?.getAll<{ id: string }>(typeName);

				state[typeName] = new Collection(data);
			} else if (shape.type === "string") {
				const value = await repository?.get<string>(typeName, typeName);

				state[typeName] = new LWWRegister<string | undefined>(value);
			} else {
				throw new TypeError(`Unsupported top-level schema shape "${shape.type}" for "${typeName}".`);
			}
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
