import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";
import type { Remote } from "@nn/remote";
import type { Entry, Repository } from "@nn/repository";
import type { ObjectSchema, Schema } from "@nn/schema";

import type { Path, PathDraft, PathValue, Recipe } from "./Path";
import { type DataFromSchema, State } from "./State";

export type { Path, PathDraft, PathValue, Recipe } from "./Path";
export { type DataFromSchema } from "./State";

export class Store<Data extends Record<string, unknown>> implements Observable {
	private eventEmitter = new EventEmitter<{ update: [] }>();

	constructor(
		private state: State<Data>,
		private repository?: Repository,
		_remote?: Remote,
	) {
		state.subscribe((changed) => {
			if (repository) {
				for (const name of changed) void this.persist(name, state.capture(name));
			}

			this.eventEmitter.emit("update");
		});
	}

	private async persist(name: string, entry: Entry): Promise<void> {
		try {
			await this.repository?.set(name, entry);
		} catch (error) {
			//TODO: LOGGER?
			console.error("Failed to persist Store record.", error);
		}
	}

	public read<const Segments extends Path<Data>>(path: Segments): PathValue<Data, Segments> {
		return this.state.read(path);
	}

	public update<const Segments extends Path<Data>>(
		path: Segments,
		recipe: Recipe<NoInfer<PathDraft<Data, Segments>>>,
	): void {
		this.state.write(path, recipe);
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
	}): Promise<Store<DataFromSchema<StoreSchema>>> {
		const persisted = new Map<string, unknown>();

		if (repository) {
			await repository.init(schema.properties);

			for (const name of Object.keys(schema.properties)) {
				persisted.set(name, await repository.get(name));
			}
		}

		return new Store(State.fromSchema(schema, persisted), repository, remote);
	}
}
