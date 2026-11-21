import type { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import type { Time } from "@nn/time";

import type { Strategy } from "./strategy";

/** Reconciles scalar schemas into `LWWRegister` entities */
export class RegisterStrategy implements Strategy {
	private defaultValue: unknown;

	constructor(defaultValue: unknown) {
		this.defaultValue = defaultValue;
	}

	public create(value: unknown, key: string, timestamp?: Time): LWWRegister<unknown> {
		return new LWWRegister(value ?? this.defaultValue, key, timestamp);
	}

	/** Writes only when the value differs by `Object.is`, so unchanged values keep their timestamp */
	public reconcile(entity: Entity, value: unknown): void {
		if (LWWRegister.is(entity) && !Object.is(entity.current, value)) {
			entity.current = value;
		}
	}

	public conform(remote: Entity): Entity | undefined {
		if (LWWRegister.is(remote)) return remote;
	}
}
