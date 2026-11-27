import type { Entity } from "@goodstate/entities/entity";
import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { RGA } from "@goodstate/entities/kinds/rga";
import { isArray } from "@goodstate/guards/is-array";
import { isObject } from "@goodstate/guards/is-object";

import { ListTracker } from "./list-tracker";
import { MapTracker } from "./map-tracker";
import type { Tracker } from "./tracker";

export class Trackers {
	private entries = new Map<Entity, Tracker>();

	public get(entity: Entity): Tracker | undefined {
		return this.entries.get(entity);
	}

	public track(entity: Entity, parent?: Tracker): unknown {
		const existing = this.entries.get(entity);

		if (existing) return existing.proxy;

		let tracker: Tracker | undefined;

		if (RGA.is(entity)) tracker = new ListTracker(entity, [], parent, this);

		if (LWWMap.is(entity)) tracker = new MapTracker(entity, {}, parent, this);

		if (tracker) {
			this.entries.set(entity, tracker);

			return tracker.proxy;
		}

		const value = entity.current;

		if (isArray(value)) return [...value];

		if (isObject(value)) return { ...value };

		return value;
	}

	public defer(entity: Entity): unknown {
		if (RGA.is(entity) || LWWMap.is(entity)) {
			return this.entries.get(entity)?.proxy ?? entity;
		}

		return this.track(entity);
	}
}
