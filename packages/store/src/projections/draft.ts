import type { Entity } from "@nn/entities/entity";

import { track } from "./tracker";
import { type ReadonlyTracker, Tracker } from "./tracker/tracker";

interface Snapshots {
	identify(value: object): Entity | undefined;
}

export class Draft {
	private trackers = new Map<Entity, Tracker>();
	public readonly value: unknown;

	constructor(
		entity: Entity,
		private readonly snapshots: Snapshots,
	) {
		this.value = track(entity, undefined, this.trackers);
	}

	public inspect(value: unknown): ReadonlyTracker | undefined {
		const tracker = Tracker.of(value);

		if (tracker?.trackers === this.trackers) return tracker;
	}

	public identify(value: object): Entity | undefined {
		return Tracker.of(value)?.entity ?? this.snapshots.identify(value);
	}

	public fill(entity: Entity): void {
		if (!this.trackers.has(entity)) track(entity, undefined, this.trackers);

		this.trackers.get(entity)?.fill();
	}
}
