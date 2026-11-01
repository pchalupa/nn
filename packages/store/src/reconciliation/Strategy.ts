import type { Entity } from "@nn/entities/Entity";
import type { Time } from "@nn/time";

export interface Strategy {
	create(value: unknown, key: string, timestamp?: Time): Entity;
	reconcile(entity: Entity, value: unknown): void;
}
