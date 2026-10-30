import { Entity } from "@nn/entities/Entity";

import { isArray, isObject } from "./guards";

interface EntityNode {
	readonly entity: Entity;
	readonly children: ReadonlyMap<string, EntityNode>;
}

export class EntityMapping {
	private mapping = new WeakMap<object, EntityNode>();

	public get(value: object): EntityNode | undefined {
		return this.mapping.get(value);
	}

	public bind(entity: Entity, value: unknown): EntityNode {
		const children = new Map<string, EntityNode>();
		const node: EntityNode = { entity, children };

		if (isObject(value)) {
			const current = entity.current;

			this.mapping.set(value, node);

			if (isArray(current)) {
				for (const [index, child] of current.entries()) {
					if (child instanceof Entity) {
						children.set(String(index), this.bind(child, value[index]));
					}
				}
			} else if (isObject(current)) {
				for (const key in current) {
					const child = current[key];

					if (child instanceof Entity) {
						children.set(key, this.bind(child, value[key]));
					}
				}
			}
		}

		return node;
	}
}
