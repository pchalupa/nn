import type { Entity } from "@nn/entities/Entity";

export class EntityMapping {
	private mapping = new WeakMap<object, Entity>();

	public get(value: object): Entity | undefined {
		return this.mapping.get(value);
	}

	public set(value: object, entity: Entity): void {
		this.mapping.set(value, entity);
	}
}
