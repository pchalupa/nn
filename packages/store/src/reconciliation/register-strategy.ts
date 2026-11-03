import type { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import type { Time } from "@nn/time";

import type { Strategy } from "./strategy";

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
