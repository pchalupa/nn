import { isArray } from "@nn/guards/isArray";
import { isObject } from "@nn/guards/isObject";

import type { Decoder, Encoded } from "./Codable";
import { Entity, type EntityDelegate } from "./Entity";

export class LWWMap<Fields extends Record<string, Entity>> extends Entity<Fields> implements EntityDelegate {
	constructor(
		private fields: Fields,
		key?: string,
	) {
		super("LWWMap", key);

		for (const name in fields) {
			fields[name].delegate = this;
		}
	}

	public entityDidChange(child: Entity): void {
		this.didChange(child);
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
			const previous = this.get(key);

			if (previous) previous.delegate = undefined;

			field.delegate = this;
			this.fields[key] = field;
		}

		this.didChange();
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

	public encode(): Encoded<Record<string, Encoded>, { kind: string }> {
		const data: Record<string, Encoded> = {};

		for (const key in this.fields) data[key] = this.fields[key].encode();

		return { key: this.key, data, metadata: { kind: this.kind } };
	}

	public static decode(encoded: Encoded, decoder: Decoder): LWWMap<Record<string, Entity>> {
		LWWMap.assertEncoded(encoded);

		const fields: Record<string, Entity> = {};

		for (const key in encoded.data) {
			const value = encoded.data[key];

			fields[key] = decoder.decode(value);
		}

		return new LWWMap(fields, encoded.key);
	}

	public static override is(entity: unknown): entity is LWWMap<Record<string, Entity>> {
		return entity instanceof LWWMap;
	}

	public static override assert(entity: unknown): asserts entity is LWWMap<Record<string, Entity>> {
		if (!LWWMap.is(entity)) throw new TypeError("Invalid LWWMap.");
	}

	private static assertEncoded(encoded: Encoded): asserts encoded is Encoded<Record<string, unknown>> {
		const { data } = encoded;

		if (!isObject(data) || isArray(data)) {
			throw new TypeError("Invalid encoded LWWMap.");
		}
	}
}
