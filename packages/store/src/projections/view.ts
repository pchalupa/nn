import { VersionedCache } from "@nn/cache/versioned-cache";
import { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";

/**
 * Frozen projections of the entity tree for `Store.query`, cached per entity by `revision`, so unchanged subtrees
 * keep their reference.
 */
export class View {
	private entities = new WeakMap<object, Entity>();
	private cachedProjections = new VersionedCache<Entity, object>();

	private materialize = (entity: Entity): object => {
		const current = entity.current;
		let value: object;

		if (isArray(current)) {
			const items: unknown[] = [];

			for (const item of current) items.push(this.unwrap(item));

			value = items;
		} else if (isObject(current)) {
			const fields: Record<string, unknown> = {};

			for (const key in current) {
				Object.defineProperty(fields, key, {
					value: this.unwrap(current[key]),
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}

			value = fields;
		} else throw new TypeError("Expected an object projection.");

		Object.freeze(value);
		this.entities.set(value, entity);

		return value;
	};

	public read(entity: Entity): unknown {
		if (LWWRegister.is(entity)) return entity.current;

		return this.cachedProjections.ensure(entity, entity.revision, this.materialize);
	}

	public identify(value: object): Entity | undefined {
		return this.entities.get(value);
	}

	private unwrap(value: unknown): unknown {
		if (Entity.is(value)) return this.read(value);

		return value;
	}
}
