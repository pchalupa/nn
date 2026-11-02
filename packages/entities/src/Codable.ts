import type { Entity } from "./Entity";
import { LWWMap } from "./LWWMap";
import { LWWRegister } from "./LWWRegister";
import { RGA } from "./RGA";

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
	readonly name: string;
	decode(encoded: Encoded, decoder: Decoder): Instance;
}

export const entities: Record<"LWWRegister" | "LWWMap" | "RGA", Decodable> = { LWWRegister, LWWMap, RGA };

export function assertEncoded(value: unknown): asserts value is Encoded {
	if (
		typeof value !== "object" ||
		value === null ||
		!("key" in value) ||
		!("data" in value) ||
		!("metadata" in value) ||
		typeof value.metadata !== "object" ||
		value.metadata === null ||
		!("kind" in value.metadata) ||
		typeof value.metadata.kind !== "string"
	) {
		throw new TypeError("Invalid encoded entity.");
	}
}

export function assertDecodable(kind: string): asserts kind is keyof typeof entities {
	if (!Object.hasOwn(entities, kind)) throw new TypeError(`Unknown entity kind "${kind}".`);
}
