import { Codec } from "@nn/entities/Codec";
import { Subject, type Observer, type Unsubscribe } from "@nn/observable/Subject";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";

import { State } from "./State";

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>>> {
	private codec = new Codec();
	private changeSubjectObservers = new Subject();

	constructor(
		public state: State<StateSchema>,
		private repository?: Repository,
		_remote?: Remote,
	) {
		state.delegate = {
			stateDidChange: (_state: State, changed: ReadonlySet<string>) => {
				for (const name of changed) void this.persist(name);

				this.changeSubjectObservers.notify();
			},
		};
	}

	public subscribe(observer: Observer): Unsubscribe {
		return this.changeSubjectObservers.subscribe(observer);
	}

	private async persist(name: string): Promise<void> {
		if (this.repository) {
			try {
				const entry = this.codec.encode(this.state.entity(name));

				await this.repository.set(name, entry);
			} catch (error) {
				// TODO: LOGGER?
				console.error("Failed to persist Store record.", error);
			}
		}
	}

	private async restore(schema: StateSchema): Promise<void> {
		await this.repository?.init(schema.properties);

		for (const name of Object.keys(schema.properties)) {
			const entry = await this.repository?.get(name);

			if (entry) this.state.merge(name, this.codec.decode(entry));
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
