import type { Entity } from "@nn/entities/entity";
import { Observable } from "@nn/observable/observable";
import type { Schema } from "@nn/schema";
import type { ObjectSchema } from "@nn/schema/object-schema";

import { State } from "./state";

export class Store<StateSchema extends ObjectSchema<Record<string, Schema>> = ObjectSchema<Record<string, Schema>>> {
	public readonly changes = new Observable<[ReadonlySet<Entity>]>();
	public readonly updates = new Observable();
	public readonly state: State<StateSchema>;

	constructor(public readonly schema: StateSchema) {
		// TODO: Consider folding state into Store
		this.state = new State(schema);
		this.state.delegate = {
			stateDidChange: (_state: State, changed: ReadonlySet<Entity>) => {
				this.changes.notify(changed);
				this.updates.notify();
			},
		};
	}
}
