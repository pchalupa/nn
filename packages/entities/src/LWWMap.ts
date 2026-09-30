import { type Unsubscribe } from "@nn/event-emitter/Observable";

import { Entity } from "./Entity";

export class LWWMap<Fields extends Record<string, Entity>> extends Entity<Fields> {
	private fieldSubscriptions = new Map<string, Unsubscribe>();

	constructor(private fields: Fields) {
		super();

		for (const key in fields) {
			const field = fields[key];
			const unsubscribe = field.subscribe(() => this.emit());

			this.fieldSubscriptions.set(key, unsubscribe);
		}
	}

	get [Symbol.toStringTag]() {
		return "LWWMap";
	}

	get current(): Fields {
		return this.fields;
	}

	set current(fields: Fields) {
		for (const key in fields) {
			const field = fields[key];

			this.fieldSubscriptions.get(key)?.();

			const unsubscribe = field.subscribe(() => this.emit());

			this.fields[key] = field;
			this.fieldSubscriptions.set(key, unsubscribe);
		}

		this.emit();
	}

	merge(remote: LWWMap<Fields>): this {
		for (const key in this.fields) {
			const localField = this.fields[key];
			const remoteField = remote.fields[key];

			if (remoteField) localField.merge(remoteField);
		}

		return this;
	}
}
