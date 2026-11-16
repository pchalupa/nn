import type { Entity } from "@nn/entities/entity";
import type { Time } from "@nn/time";

import type { DraftNode } from "../projectors/draft-node";

export interface ReconcileContext {
	// TODO: Consider refactoring to DraftNode that comes from draft
	draftNodeOf(value: unknown): DraftNode | undefined;
	settle(entity: Entity): void;
	entityOf(value: object): Entity | undefined;
}

export interface Strategy {
	create(value: unknown, key: string, timestamp?: Time): Entity;
	reconcile(entity: Entity, value: unknown, context: ReconcileContext): void;
	conform(remote: Entity): Entity;
}
