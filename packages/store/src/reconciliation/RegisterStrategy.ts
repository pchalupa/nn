import type { Entity } from "@nn/entities/Entity";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import type { Time } from "@nn/time";

import type { Strategy } from "./Strategy";

export class RegisterStrategy implements Strategy {
	constructor(private defaultValue: unknown) {}

	public create(value: unknown, key: string, timestamp?: Time): LWWRegister<unknown> {
		return new LWWRegister(value ?? this.defaultValue, key, timestamp);
	}

	public reconcile(entity: Entity, value: unknown): void {
		if (entity instanceof LWWRegister) {
			if (!Object.is(entity.current, value)) {
				entity.current = value;
			}
		}
	}
}
