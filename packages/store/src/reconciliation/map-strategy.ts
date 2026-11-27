import type { Entity } from "@goodstate/entities/entity";
import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { isObject } from "@goodstate/guards/is-object";
import { Time } from "@goodstate/time";

import type { ReconcileContext, Strategy } from "./strategy";

/** Reconciles object schemas into `LWWMap` entities. */
export class MapStrategy implements Strategy {
	private fields: ReadonlyMap<string, Strategy>;

	constructor(fields: ReadonlyMap<string, Strategy>) {
		this.fields = fields;
	}

	public create(value: unknown, key: string, timestamp?: Time): LWWMap<Record<string, Entity>> {
		const source = isObject(value) ? value : {};
		const fields: Record<string, Entity> = {};

		for (const [name, field] of this.fields) {
			fields[name] = field.create(source[name], name, timestamp);
		}

		return new LWWMap(fields, key);
	}

	public reconcile(entity: Entity, value: unknown, context: ReconcileContext): void {
		const tracker = context.inspect(value);

		if (tracker?.entity === entity && !tracker.dirty) return;

		const target = tracker?.entity === entity ? tracker.target : value;

		if (LWWMap.is(entity) && isObject(target)) {
			context.fill(entity);

			for (const [name, strategy] of this.fields) {
				const field = entity.get(name);
				const item = target[name];

				if (field && field !== item) {
					strategy.reconcile(field, context.resolve(item, value, name), context);
				}
			}
		}
	}

	/**
	 * Keeps only declared fields, filling missing ones and replacing ones of another kind.
	 */
	public conform(remote: Entity): Entity | undefined {
		if (LWWMap.is(remote)) {
			const fields: Record<string, Entity> = {};

			for (const [name, strategy] of this.fields) {
				const remoteField = remote.get(name);
				const conformed = remoteField ? strategy.conform(remoteField) : undefined;

				fields[name] = conformed ?? strategy.create(undefined, name, Time.epoch());
			}

			return new LWWMap(fields, remote.key);
		}
	}

	public get(name: string): Strategy | undefined {
		return this.fields.get(name);
	}
}
