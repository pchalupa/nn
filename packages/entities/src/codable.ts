import { isObject } from "@nn/guards/is-object";
import { isString } from "@nn/guards/is-string";

import type { Entity } from "./entity";
import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";
import { RGA } from "./rga";

export interface Encoded<Data = unknown, Metadata extends { kind: string } = { kind: string }> {
	key: string;
	data: Data;
	metadata: Metadata;
}

export interface Encodable {
	encode(): Encoded;
}

export interface Decoder {
	decode(value: unknown): Entity;
}

export interface Decodable<Instance extends Entity = Entity> {
	decode(encoded: Encoded, decoder: Decoder): Instance;
}

export const entities: { LWWRegister: typeof LWWRegister; LWWMap: typeof LWWMap; RGA: typeof RGA } = {
	LWWRegister,
	LWWMap,
	RGA,
};

export function assertEncoded(value: unknown): asserts value is Encoded {
	if (
		!isObject(value) ||
		!("key" in value) ||
		!("data" in value) ||
		!isObject(value.metadata) ||
		!isString(value.metadata.kind)
	) {
		throw new TypeError("Invalid encoded entity.");
	}
}

export function assertDecodable(kind: string): asserts kind is keyof typeof entities {
	if (!Object.hasOwn(entities, kind)) throw new TypeError(`Unknown entity kind "${kind}".`);
}
