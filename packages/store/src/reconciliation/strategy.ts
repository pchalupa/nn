import type { Entity } from "@nn/entities/entity";
import type { Time } from "@nn/time";

import type { ReadonlyDraftHandler } from "../projectors/draft-handler";

export interface ReconcileContext {
	// TODO: Consider refactoring to ReadonlyDraftHandler that comes from draft
	inspect(value: unknown): ReadonlyDraftHandler | undefined;
	fill(entity: Entity): void;
	identify(value: object): Entity | undefined;
}

export interface Strategy {
	create(value: unknown, key: string, timestamp?: Time): Entity;
	reconcile(entity: Entity, value: unknown, context: ReconcileContext): void;
	conform(remote: Entity): Entity;
}
