import { Entity } from "@nn/entities/entity";
import { isObject } from "@nn/guards/is-object";

import { type ReadonlyTracker, Tracker } from "./tracker/tracker";
import { Trackers } from "./tracker/trackers";

interface Snapshots {
	identify(value: object): Entity | undefined;
}

/**
 * Lazy, proxy-based copy of the state that a `Store.mutate` recipe edits. One draft per `mutate` call.
 */
export class Draft {
	private trackers = new Trackers();
	private snapshots: Snapshots;
	public readonly value: unknown;

	constructor(entity: Entity, snapshots: Snapshots) {
		this.snapshots = snapshots;
		this.value = this.trackers.track(entity);
	}

	public inspect(value: unknown): ReadonlyTracker | undefined {
		const tracker = Tracker.of(value);

		if (tracker?.trackers === this.trackers) return tracker;
	}

	/** Maps draft proxies and `Store.query` results back to their entities */
	public identify(value: object): Entity | undefined {
		return Tracker.of(value)?.entity ?? this.snapshots.identify(value);
	}

	public resolve(item: unknown, parent: unknown, key: string | number): unknown {
		if (Entity.is(item) && isObject(parent)) {
			return parent[key];
		}

		return item;
	}

	public fill(entity: Entity): void {
		this.trackers.track(entity);
		this.trackers.get(entity)?.fill();
	}
}
