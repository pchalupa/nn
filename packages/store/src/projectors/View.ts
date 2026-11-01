import type { Entity } from "@nn/entities/Entity";
import { isObject } from "@nn/guards/isObject";

import { Projector } from "./Projector";

interface Snapshot {
	readonly value: unknown;
	readonly revision: number;
}

export class View extends Projector {
	private snapshots = new WeakMap<Entity, Snapshot>();

	constructor(
		private state: Entity,
		entities: WeakMap<object, Entity>,
	) {
		super(entities);
	}

	public get value(): unknown {
		return this.child(this.state);
	}

	protected child(entity: Entity): unknown {
		const revision = entity.revision;
		const cached = this.snapshots.get(entity);

		if (cached !== undefined && cached.revision === revision) return cached.value;

		const value = this.project(entity);

		if (isObject(value)) this.snapshots.set(entity, { value, revision });

		return value;
	}
}
