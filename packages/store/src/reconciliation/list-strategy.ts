import { Entity } from "@goodstate/entities/entity";
import { RGA } from "@goodstate/entities/kinds/rga";
import { isArray } from "@goodstate/guards/is-array";
import { isObject } from "@goodstate/guards/is-object";
import { ID } from "@goodstate/id";
import type { Time } from "@goodstate/time";

import type { ReconcileContext, Strategy } from "./strategy";

/** Reconciles array schemas into `RGA` entities */
export class ListStrategy implements Strategy {
	private items: Strategy;

	constructor(items: Strategy) {
		this.items = items;
	}

	public create(value: unknown, key: string, timestamp?: Time): RGA<Entity> {
		if (isArray(value)) {
			const items: Entity[] = [];

			for (const item of value) {
				items.push(this.items.create(item, ID.create(), timestamp));
			}

			return new RGA(items, key);
		}

		return new RGA([], key);
	}

	/**
	 * Reconciles only changed items when the list itself wasn't written. Otherwise it matches items, objects by
	 * identity within this list and primitives by index, then removes, appends and reconciles.
	 */
	public reconcile(entity: Entity, value: unknown, context: ReconcileContext): void {
		const tracker = context.inspect(value);
		const drafted = tracker?.entity === entity;

		if (drafted && !tracker.written) {
			for (const item of tracker.changed) {
				this.items.reconcile(item.entity, item.proxy, context);
			}
		} else {
			const target = drafted ? tracker.target : value;

			if (RGA.is(entity) && isArray(target)) {
				context.fill(entity);

				const matches = this.match(entity, target, context);
				const kept = new Set<string>();

				for (const match of matches) {
					if (match) kept.add(match.key);
				}

				if (kept.size !== entity.size) {
					const removed: string[] = [];

					for (const key of entity.keys()) {
						if (!kept.has(key)) removed.push(key);
					}

					for (const key of removed) {
						entity.remove(key);
					}
				}

				for (let index = 0; index < matches.length; index++) {
					const match = matches[index];
					const item = target[index];

					if (!match) {
						entity.push(this.items.create(context.resolve(item, value, index), ID.create()));
					} else if (match !== item) {
						this.items.reconcile(match, item, context);
					}
				}
			}
		}
	}

	/** Drops items whose kind doesn't fit the item schema */
	public conform(remote: Entity): Entity | undefined {
		if (!RGA.is(remote)) return undefined;

		const items: Entity[] = [];

		for (const item of remote) {
			const conformed = this.items.conform(item);

			if (conformed) items.push(conformed);
		}

		return new RGA(items, remote.key, remote.tombstones);
	}

	private match(list: RGA<Entity>, value: readonly unknown[], context: ReconcileContext): Array<Entity | undefined> {
		const matches: Array<Entity | undefined> = [];

		for (let index = 0; index < value.length; index++) {
			const item = value[index];

			if (isObject(item)) {
				matches.push(this.find(list, item, context));
			} else {
				matches.push(list.current[index]);
			}
		}

		return matches;
	}

	private find(list: RGA<Entity>, item: object, context: ReconcileContext): Entity | undefined {
		const previous = context.identify(item) ?? (Entity.is(item) ? item : undefined);

		return previous !== undefined && list.get(previous.key) === previous ? previous : undefined;
	}
}
