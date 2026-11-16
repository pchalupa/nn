import type { Entity } from "@nn/entities/entity";
import type { Time } from "@nn/time";

import type { ReadonlyTracker } from "../projectors/tracker/tracker";

export interface ReconcileContext {
	// TODO: Consider refactoring to ReadonlyTracker that comes from draft
	inspect(value: unknown): ReadonlyTracker | undefined;
	fill(entity: Entity): void;
	identify(value: object): Entity | undefined;
}

export interface Strategy {
	create(value: unknown, key: string, timestamp?: Time): Entity;
	reconcile(entity: Entity, value: unknown, context: ReconcileContext): void;
	conform(remote: Entity): Entity;
}
