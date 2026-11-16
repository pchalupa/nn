import type { Entity } from "@nn/entities/entity";
import type { Time } from "@nn/time";

import type { ReadonlyTracker } from "../projections/tracker/tracker";

export interface ReconcileContext {
	// TODO: Consider refactoring to ReadonlyTracker that comes from draft
	inspect(value: unknown): ReadonlyTracker | undefined;
	fill(entity: Entity): void;
	identify(value: object): Entity | undefined;
}

export abstract class Strategy {
	public abstract create(value: unknown, key: string, timestamp?: Time): Entity;
	public abstract reconcile(entity: Entity, value: unknown, context: ReconcileContext): void;
	public abstract conform(remote: Entity): Entity;

	public static is(strategy: unknown): strategy is Strategy {
		return strategy instanceof Strategy;
	}

	public static assert(strategy: unknown): asserts strategy is Strategy {
		if (!Strategy.is(strategy)) throw new TypeError("Invalid strategy.");
	}
}
