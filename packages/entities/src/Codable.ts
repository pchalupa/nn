import type { Entity } from "./Entity";

export interface Encoded<Data = unknown, Metadata extends { kind: string } = { kind: string }> {
	key: string;
	data: Data;
	metadata: Metadata;
}

export interface Encodable {
	encode(): Encoded;
}

export interface Decoder {
	decode(encoded: Encoded): Entity;
}

export interface Decodable<Instance extends Entity = Entity> {
	readonly name: string;
	decode(encoded: Encoded, decoder: Decoder): Instance;
}
