import { assertDecodable, assertEncoded, type Encoded, entities } from "./Codable";
import type { Entity } from "./Entity";

export class Codec {
	public encode(entity: Entity): Encoded {
		return entity.encode();
	}

	public decode(value: unknown): Entity {
		assertEncoded(value);
		assertDecodable(value.metadata.kind);

		const entity = entities[value.metadata.kind];

		return entity.decode(value, { decode: (child) => this.decode(child) });
	}
}
