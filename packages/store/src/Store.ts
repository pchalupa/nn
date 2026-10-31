import { Subject, type Observer, type Unsubscribe } from "@nn/observable/Subject";
import type { Remote } from "@nn/remote";
import type { Repository } from "@nn/repository";
import type { Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/ObjectSchema";

import { Codec } from "./Codec";
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
		if (!this.repository) return;

		try {
			await this.repository.set(name, this.codec.toEntry(this.state.encode(name)));
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
