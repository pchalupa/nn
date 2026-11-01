import type { Entity } from "@nn/entities/Entity";
import { RGA } from "@nn/entities/kinds/RGA";
import { ID } from "@nn/id";
import type { Time } from "@nn/time";

import { isArray } from "../guards/isArray";
import { isObject } from "../guards/isObject";
import type { Strategy } from "./Strategy";

interface Match {
	readonly entity: Entity | undefined;
	readonly value: unknown;
}

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
			const kept = new Set(matches.flatMap((match) => (match.entity === undefined ? [] : [match.entity.key])));

			for (const row of entity.current) {
				if (!kept.has(row.key)) entity.remove(row.key);
			}

			for (const match of matches) {
				if (match.entity === undefined) entity.push(this.items.create(match.value, ID.create()));
				else this.items.reconcile(match.entity, match.value);
			}
		}
	}

	private match(list: RGA<Entity>, value: readonly unknown[]): Match[] {
		const current = list.current;

		return Array.from(value, (item, index) => ({
			entity: isObject(item) ? this.find(list, item) : current[index],
			value: item,
		}));
	}

	private find(list: RGA<Entity>, item: object): Entity | undefined {
		const previous = this.entities.get(item);

		return previous !== undefined && list.find(previous.key) === previous ? previous : undefined;
	}
}
