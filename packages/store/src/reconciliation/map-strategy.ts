import { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { isObject } from "@nn/guards/is-object";
import { Time } from "@nn/time";

import type { ReconcileContext, Strategy } from "./strategy";

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

	public reconcile(entity: Entity, value: unknown, context: ReconcileContext): void {
		const handler = context.inspect(value);

		if (handler?.entity === entity && !handler.modified) return;

		const target = handler?.entity === entity ? handler.target : value;

		if (LWWMap.is(entity) && isObject(target)) {
			context.fill(entity);

			for (const [name, strategy] of this.fields) {
				const field = entity.get(name);
				const item = target[name];

				if (field && field !== item) {
					strategy.reconcile(field, Entity.is(item) && isObject(value) ? Reflect.get(value, name) : item, context);
				}
			}
		}
	}

	public conform(remote: Entity): Entity {
		if (LWWMap.is(remote)) {
			const fields: Record<string, Entity> = { ...remote.current };

			for (const [name, strategy] of this.fields) {
				const remoteField = remote.get(name);

				if (remoteField === undefined) {
					fields[name] = strategy.create(undefined, name, Time.epoch());
				} else {
					fields[name] = strategy.conform(remoteField);
				}
			}

			return new LWWMap(fields, remote.key);
		}

		return remote;
	}

	public get(name: string): Strategy | undefined {
		return this.fields.get(name);
	}
}
