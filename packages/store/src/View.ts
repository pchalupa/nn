import { Entity, type InferValueType } from "@nn/entities/Entity";

import { isArray, isObject } from "./guards";

export class View<Root extends Entity = Entity> {
	private projection?: InferValueType<Root>;

	constructor(private readonly root: Root) {}

	public get value(): InferValueType<Root> {
		if (this.projection === undefined) this.projection = this.materialize(this.root);

		return this.projection;
	}

	public invalidate(): void {
		this.projection = undefined;
	}

	private materialize<E extends Entity>(entity: E): InferValueType<E>;
	private materialize(entity: Entity): unknown {
		const current = entity.current;

		if (isArray(current)) {
			const result: unknown[] = [];

			for (const item of current) {
				if (item instanceof Entity) result.push(this.materialize(item));
				else result.push(structuredClone(item));
			}

			return result;
		}

		if (isObject(current)) {
			const result: Record<string, unknown> = {};

			for (const key in current) {
				const field: unknown = current[key];

				if (field instanceof Entity) result[key] = this.materialize(field);
				else result[key] = structuredClone(field);
			}

			return result;
		}

		return current;
	}
}
