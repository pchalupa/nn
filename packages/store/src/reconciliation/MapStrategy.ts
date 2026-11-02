import type { Entity } from "@nn/entities/Entity";
import { LWWMap } from "@nn/entities/kinds/LWWMap";
import { isObject } from "@nn/guards/isObject";
import type { Time } from "@nn/time";

import type { Strategy } from "./Strategy";

export class MapStrategy implements Strategy {
	constructor(private fields: ReadonlyMap<string, Strategy>) {}

	public create(value: unknown, key: string, timestamp?: Time): LWWMap<Record<string, Entity>> {
		const source = isObject(value) ? value : {};
		const fields: Record<string, Entity> = {};

		for (const [name, field] of this.fields) {
			fields[name] = field.create(source[name], name, timestamp);
		}

		return new LWWMap(fields, key);
	}

	public reconcile(entity: Entity, value: unknown): void {
		if (entity instanceof LWWMap && isObject(value)) {
			for (const [name, strategy] of this.fields) {
				const field = entity.get(name);

				if (field !== undefined) strategy.reconcile(field, value[name]);
			}
		}
	}
}
