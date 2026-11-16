import type { Entity } from "@nn/entities/entity";

import { type ReadonlyTracker, Tracker } from "./tracker";

interface Snapshots {
	identify(value: object): Entity | undefined;
}

export class Draft {
	private readonly trackers = new Map<Entity, Tracker>();
	public readonly value: unknown;

	constructor(
		entity: Entity,
		private readonly snapshots: Snapshots,
	) {
		this.value = Tracker.wrap(entity, undefined, this.trackers);
	}

	public inspect(value: unknown): ReadonlyTracker | undefined {
		const tracker = Tracker.of(value);

		if (tracker?.trackers === this.trackers) return tracker;
	}

	public identify(value: object): Entity | undefined {
		return Tracker.of(value)?.entity ?? this.snapshots.identify(value);
	}

	public fill(entity: Entity): void {
		this.trackers.get(entity)?.fill();
	}
}
