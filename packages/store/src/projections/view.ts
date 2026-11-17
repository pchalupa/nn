import { VersionedCache } from "@nn/cache/versioned-cache";
import { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";

export class View {
	private entities = new WeakMap<object, Entity>();
	private cachedProjections = new VersionedCache<Entity, object>();

	private materialize = (entity: Entity): object => {
		const value = this.project(entity.current);

		if (!isObject(value)) throw new TypeError("Expected an object projection.");

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

	private project(current: unknown): unknown {
		if (isArray(current)) {
			const value: unknown[] = [];

			for (const item of current) value.push(this.unwrap(item));

			return value;
		}

		if (isObject(current)) {
			const value: Record<string, unknown> = {};

			for (const key in current) {
				Object.defineProperty(value, key, {
					value: this.unwrap(current[key]),
					writable: true,
					enumerable: true,
					configurable: true,
				});
			}

			return value;
		}

		return current;
	}

	private unwrap(value: unknown): unknown {
		if (Entity.is(value)) return this.read(value);

		return value;
	}
}
