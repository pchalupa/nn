import type { Unsubscribe } from "@nn/event-emitter/Observable";

import type { Decoder, Encoded } from "./Codable";
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

	public get(name: string): Entity | undefined {
		return Object.hasOwn(this.fields, name) ? this.fields[name] : undefined;
	}

	public merge(remote: LWWMap<Fields>): this {
		for (const key in this.fields) {
			const localField = this.fields[key];
			const remoteField = Object.hasOwn(remote.fields, key) ? remote.fields[key] : undefined;

			if (remoteField) localField.merge(remoteField);
		}

		return this;
	}

	public static decode(encoded: Encoded<Record<string, Encoded>>, decoder: Decoder): LWWMap<Record<string, Entity>> {
		const fields: Record<string, Entity> = {};

		for (const key in encoded.data) fields[key] = decoder.decode(encoded.data[key]);

		return new LWWMap(fields, encoded.key);
	}

	public encode(): Encoded<Record<string, Encoded>, { kind: string }> {
		const data: Record<string, Encoded> = {};

		for (const key in this.fields) data[key] = this.fields[key].encode();

		return { key: this.key, data, metadata: { kind: this.constructor.name } };
	}
}
