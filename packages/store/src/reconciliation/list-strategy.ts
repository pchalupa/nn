import type { Entity } from "@nn/entities/entity";
import { RGA } from "@nn/entities/kinds/rga";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";
import { ID } from "@nn/id";
import type { Time } from "@nn/time";

import type { Strategy } from "./strategy";

export class ListStrategy implements Strategy {
	constructor(
		private items: Strategy,
		private entities: WeakMap<object, Entity>,
	) {}

	public create(value: unknown, key: string, timestamp?: Time): RGA<Entity> {
		if (isArray(value)) {
			const items = Array.from(value, (item) => this.items.create(item, ID.create(), timestamp));

			return new RGA(items, key);
		}

		return new RGA([], key);
	}

	public reconcile(entity: Entity, value: unknown): void {
		if (RGA.is(entity) && isArray(value)) {
			const matches = this.match(entity, value);
			const kept = new Set<string>();

			for (const match of matches) {
				if (match) kept.add(match.key);
			}

			if (kept.size !== entity.size) {
				const removed: string[] = [];

				for (const key of entity.keys()) {
					if (!kept.has(key)) removed.push(key);
				}

				for (const key of removed) entity.remove(key);
			}

			for (let index = 0; index < matches.length; index++) {
				const match = matches[index];

				if (match === undefined) entity.push(this.items.create(value[index], ID.create()));
				else this.items.reconcile(match, value[index]);
			}
		}
	}

	public conform(remote: Entity): Entity {
		if (RGA.is(remote)) return remote.map((row) => this.items.conform(row));

		return remote;
	}

	private match(list: RGA<Entity>, value: readonly unknown[]): Array<Entity | undefined> {
		const matches: Array<Entity | undefined> = [];
		let current: Entity[] | undefined;

		for (let index = 0; index < value.length; index++) {
			const item = value[index];

			if (isObject(item)) {
				matches.push(this.find(list, item));
			} else {
				current ??= list.current;
				matches.push(current[index]);
			}
		}

		return matches;
	}

	private find(list: RGA<Entity>, item: object): Entity | undefined {
		const previous = this.entities.get(item);

		return previous !== undefined && list.find(previous.key) === previous ? previous : undefined;
	}
}
