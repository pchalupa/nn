import { Entity } from "@nn/entities/Entity";
import { isArray } from "@nn/guards/isArray";
import { isObject } from "@nn/guards/isObject";

export abstract class Projector {
	constructor(protected entities: WeakMap<object, Entity>) {}

	private unwrap(value: unknown): unknown {
		return value instanceof Entity ? this.child(value) : value;
	}

	protected child(entity: Entity): unknown {
		return this.project(entity);
	}

	protected project(entity: Entity): unknown {
		const current: unknown = entity.current;

		if (isObject(current)) {
			if (isArray(current)) {
				const value: unknown[] = [];

				for (const item of current) value.push(this.unwrap(item));

				this.entities.set(value, entity);

				return value;
			}

			const value: Record<string, unknown> = {};

			for (const key of Object.keys(current)) {
				value[key] = this.unwrap(current[key]);
			}

			this.entities.set(value, entity);

			return value;
		}

		return current;
	}
}
