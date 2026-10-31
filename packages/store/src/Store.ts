import type { Remote } from "@nn/remote";
import type { Entry, Repository } from "@nn/repository";
import type { Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";

import { Codec } from "./Codec";
import { State, type StateDelegate } from "./State";

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>>> implements StateDelegate {
	private codec = new Codec();

	constructor(
		public state: State<StateSchema>,
		private repository?: Repository,
		_remote?: Remote,
	) {
		state.delegate = this;
	}

	public stateDidChange(state: State, changed: ReadonlySet<string>): void {
		if (this.repository) {
			for (const name of changed) {
				void this.persist(name, this.codec.toEntry(state.encode(name)));
			}
		}
	}

	private async persist(name: string, entry: Entry): Promise<void> {
		try {
			await this.repository?.set(name, entry);
		} catch (error) {
			// TODO: LOGGER?
			console.error("Failed to persist Store record.", error);
		}
	}

	private async restore(schema: StateSchema): Promise<void> {
		await this.repository?.init(schema.properties);

		for (const name of Object.keys(schema.properties)) {
			const entity = this.codec.decode(await this.repository?.get(name), name);

			if (entity) this.state.merge(name, entity);
		}
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
		const store = new Store(new State(schema), repository, remote);

		if (repository) await store.restore(schema);

		return store;
	}
}
