import type { Unsubscribe } from "@nn/event-emitter/Observable";

import { Entity } from "./Entity";

export class LWWMap<Fields extends Record<string, Entity>> extends Entity<Fields> {
	/** Holds a map of field unsubscribe functions. */
	private subscriptions = new Map<string, Unsubscribe>();

	constructor(
		private fields: Fields,
		key?: string,
	) {
		super(key);

		for (const name in fields) {
			const field = fields[name];
			const unsubscribe = field.subscribe(() => this.emit("change"));

			this.subscriptions.set(name, unsubscribe);
		}
	}

	public get [Symbol.toStringTag](): string {
		return "LWWMap";
	}

	public get current(): Fields {
		return this.fields;
	}

	public set current(fields: Fields) {
		for (const key in fields) {
			const field = fields[key];

			this.subscriptions.get(key)?.();

			const unsubscribe = field.subscribe(() => this.emit("change"));

			this.fields[key] = field;
			this.subscriptions.set(key, unsubscribe);
		}

		this.emit("change");
	}

	public merge(remote: LWWMap<Fields>): this {
		for (const key in this.fields) {
			const localField = this.fields[key];
			const remoteField = remote.fields[key];

			if (remoteField) localField.merge(remoteField);
		}

		return this;
	}
}
