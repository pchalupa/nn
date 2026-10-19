import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";
import type { Remote } from "@nn/remote";
import type { Entry, Repository } from "@nn/repository";
import type { ObjectSchema, Schema } from "@nn/schema";

import type { Path, PathValue, Update } from "./Path";
import { type DataFromSchema, State } from "./State";

export type { Path, PathValue, Update } from "./Path";
export { type DataFromSchema } from "./State";

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>>> implements Observable {
	private eventEmitter = new EventEmitter<{ update: [] }>();

	constructor(
		private state: State<StateSchema>,
		private repository?: Repository,
		//@ts-expect-error remote integration is pending
		private _remote?: Remote,
	) {
		state.subscribe((changed) => {
			if (repository) for (const name of changed) void this.persist(name, state.capture(name));

			this.eventEmitter.emit("update");
		});
	}

	private async persist(name: string, entry: Entry): Promise<void> {
		try {
			await this.repository?.set(name, entry);
		} catch (error) {
			// TODO: LOGGER?
			console.error("Failed to persist Store record.", error);
		}
	}

	public read<const Segments extends readonly string[] & Path<DataFromSchema<StateSchema>>>(
		path: Segments,
	): PathValue<DataFromSchema<StateSchema>, Segments> {
		return this.state.read(path);
	}

	public update<const Segments extends readonly string[] & Path<DataFromSchema<StateSchema>>>(
		path: Segments,
		recipe: Parameters<Update<DataFromSchema<StateSchema>, Segments>>[0],
	): void {
		this.state.update(path, recipe);
	}

	public subscribe(listener: Callback): Unsubscribe {
		this.eventEmitter.on("update", listener);

		return () => this.eventEmitter.off("update", listener);
	}

	public static async fromSchema<StateSchema extends ObjectSchema<Record<string, Schema>>>({
		schema,
		repository,
		remote,
	}: {
		schema: StateSchema;
		repository?: Repository;
		remote?: Remote;
	}): Promise<Store<StateSchema>> {
		const persisted = new Map<string, unknown>();

		if (repository) {
			await repository.init(schema.properties);

			for (const name of Object.keys(schema.properties)) {
				persisted.set(name, await repository.get(name));
			}
		}

		const state = new State(schema, persisted);
		const store = new Store(state, repository, remote);

		return store;
	}
}
