import type { Entity } from "@goodstate/entities/entity";
import type { Time } from "@goodstate/time";

import type { ReadonlyTracker } from "../projections/tracker/tracker";

export interface ReconcileContext {
	// TODO: Consider refactoring to ReadonlyTracker that comes from draft
	inspect(value: unknown): ReadonlyTracker | undefined;
	fill(entity: Entity): void;
	identify(value: object): Entity | undefined;
	resolve(item: unknown, parent: unknown, key: string | number): unknown;
}

/** Write side of the store for one schema node. Strategies form a tree that mirrors the schema. */
export interface Strategy {
	/** Builds a new entity from a plain value, using schema defaults for missing values */
	create(value: unknown, key: string, timestamp?: Time): Entity;
	/** Applies a draft or plain value to an existing entity, changing only what differs */
	reconcile(entity: Entity, value: unknown, context: ReconcileContext): void;
	/** Adapts a decoded remote entity to the schema before it's merged, or returns `undefined` when its kind doesn't fit */
	conform(remote: Entity): Entity | undefined;
}
