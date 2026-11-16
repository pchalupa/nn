import { Entity } from "@nn/entities/entity";
import type { LWWMap } from "@nn/entities/kinds/lww-map";

import { Tracker } from "./tracker";

export class MapTracker extends Tracker<LWWMap<Record<string, Entity>>, Record<string, unknown>> {
	protected seed(): void {
		const fields = this.entity.current;

		for (const key in fields) {
			this.target[key] = this.placeholder(fields[key]);
		}
	}

	protected pending(_key: string | symbol, value: unknown): value is Entity {
		return Entity.is(value);
	}
}
