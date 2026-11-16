import type { Entity } from "@nn/entities/entity";

import { type ReadonlyDraftHandler, DraftHandler } from "./draft-handler";

interface Snapshots {
	identify(value: object): Entity | undefined;
}

export class Draft {
	private readonly handlers = new Map<Entity, DraftHandler>();
	public readonly value: unknown;

	constructor(
		entity: Entity,
		private readonly snapshots: Snapshots,
	) {
		this.value = DraftHandler.wrap(entity, undefined, this.handlers);
	}

	public inspect(value: unknown): ReadonlyDraftHandler | undefined {
		const handler = DraftHandler.of(value);

		if (handler?.handlers === this.handlers) return handler;
	}

	public identify(value: object): Entity | undefined {
		return DraftHandler.of(value)?.entity ?? this.snapshots.identify(value);
	}

	public fill(entity: Entity): void {
		this.handlers.get(entity)?.fill();
	}
}
