import type { Entity } from "@nn/entities/Entity";

import { Projector } from "./Projector";

export class Draft extends Projector {
	public create(entity: Entity): unknown {
		return this.project(entity);
	}
}
