import type { Entity } from "@nn/entities/Entity";
import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Unsubscribe } from "@nn/event-emitter/Observable";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { ObjectSchema, Schema } from "@nn/schema";

import { Batch } from "./Batch";
import type { Recipe } from "./Draft";
import type { Path, PathDraft, PathValue } from "./Path";
import { State, type StateFromSchema } from "./State";
import { materializeRow } from "./View";

export type { Recipe } from "./Draft";
export type { Path, PathDraft, PathValue } from "./Path";
export { State, type StateFromSchema } from "./State";

export class Store<Entries extends Record<string, Entity>> {
	private eventEmitter = new EventEmitter<{ update: [] }>();
	private batch = new Batch();

	constructor(
		private state: State<Entries>,
		repository?: Repository,
		_remote?: Remote,
	) {
		for (const name in this.state.entries) {
			const entity = this.state.entries[name];

			entity.subscribe(() => this.batch.request(() => this.eventEmitter.emit("update")));

			if (repository) {
				// TODO: Persist CRDT metadata
				entity.subscribe(async () => {
					if (Array.isArray(entity.current)) {
						// TODO: This needs rework. Saving one by one is not atomic update, deleted items stays in repository.
						for (const value of entity.current) {
							repository.set(value.key, materializeRow(value), name);
						}
					} else {
						const value = entity.current;

						repository.set(name, value, name);
					}
				});
			}
		}
	}

	public read<const Segments extends Path<Entries>>(path: Segments): PathValue<Entries, Segments, true> {
		return this.state.read(path);
	}

	public update<const Segments extends Path<Entries>>(
		path: Segments,
		recipe: Recipe<NoInfer<PathDraft<Entries, Segments>>>,
	): void {
		this.batch.run(() => this.state.write(path, recipe));
	}

	public subscribe(listener: Callback): Unsubscribe {
		this.eventEmitter.on("update", listener);

		return () => this.eventEmitter.off("update", listener);
	}

	public static async fromSchema<StoreSchema extends ObjectSchema<Record<string, Schema>>>({
		schema,
		repository,
		remote,
	}: {
		schema: StoreSchema;
		repository?: Repository;
		remote?: Remote;
	}): Promise<Store<StateFromSchema<StoreSchema>>> {
		// TODO: schema should not get access to repository.
		const state = await State.fromSchema(schema, repository);

		return new Store<StateFromSchema<StoreSchema>>(state, repository, remote);
	}
}
