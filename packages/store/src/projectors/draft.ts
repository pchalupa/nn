import type { Entity } from "@nn/entities/entity";

import { Projector } from "./projector";

export class Draft extends Projector {
	public create(entity: Entity): unknown {
		return this.project(entity);
	}
}
