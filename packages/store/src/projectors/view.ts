import { Entity } from "@nn/entities/entity";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";

export class View {
	private materialized = new WeakMap<Entity, { value: unknown; revision: number }>();
	private entities = new WeakMap<object, Entity>();

	public read(entity: Entity): unknown {
		const revision = entity.revision;
		const cached = this.materialized.get(entity);

		if (cached !== undefined && cached.revision === revision) return cached.value;

		const value = this.project(entity.current);

		if (isObject(value)) {
			Object.freeze(value);

			this.entities.set(value, entity);
			this.materialized.set(entity, { value, revision });
		}

		return value;
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

			for (const key in current) value[key] = this.unwrap(current[key]);

			return value;
		}

		return current;
	}

	private unwrap(value: unknown): unknown {
		if (Entity.is(value)) return this.read(value);

		return value;
	}
}
