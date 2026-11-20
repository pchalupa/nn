import { assertDecodable, assertEncoded, type Encoded, entities } from "./codable";
import type { Entity } from "./entity";

/**
 * Converts entities to and from their JSON-safe {@link Encoded} form.
 *
 * @example
 * const codec = new Codec();
 * const copy = codec.decode(JSON.parse(JSON.stringify(codec.encode(entity))));
 */
export class Codec {
	public encode(entity: Entity): Encoded {
		return entity.encode();
	}

	/**
	 * Decodes an untrusted value into a new entity tree.
	 *
	 * @throws {TypeError} When the value isn't a valid encoded entity.
	 * @throws {TimestampMalformedError} When a timestamp can't be parsed.
	 */
	public decode(value: unknown): Entity {
		assertEncoded(value);
		assertDecodable(value.metadata.kind);

		const entity = entities[value.metadata.kind];

		return entity.decode(value, { decode: (child) => this.decode(child) });
	}
}
