import { Entity } from "@nn/entities/entity";
import type { LWWMap } from "@nn/entities/kinds/lww-map";

import type { Reader, Tracker } from "./tracker";

export class MapReader implements Reader {
	public readonly target: Record<string, unknown> = {};

	constructor(public readonly entity: LWWMap<Record<string, Entity>>) {}

	public peek(): unknown {
		return undefined;
	}

	public seed(tracker: Tracker): void {
		const fields = this.entity.current;

		for (const key in fields) {
			this.target[key] = tracker.placeholder(fields[key]);
		}
	}

	public pending(_key: string | symbol, value: unknown): value is Entity {
		return Entity.is(value);
	}
}
