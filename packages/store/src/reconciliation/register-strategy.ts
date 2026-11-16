import type { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import type { Time } from "@nn/time";

import { Strategy } from "./strategy";

export class RegisterStrategy extends Strategy {
	constructor(private defaultValue: unknown) {
		super();
	}

	public create(value: unknown, key: string, timestamp?: Time): LWWRegister<unknown> {
		return new LWWRegister(value ?? this.defaultValue, key, timestamp);
	}

	public reconcile(entity: Entity, value: unknown): void {
		if (LWWRegister.is(entity) && !Object.is(entity.current, value)) {
			entity.current = value;
		}
	}

	public conform(remote: Entity): Entity {
		return remote;
	}

	public static override is(strategy: unknown): strategy is RegisterStrategy {
		return strategy instanceof RegisterStrategy;
	}

	public static override assert(strategy: unknown): asserts strategy is RegisterStrategy {
		if (!RegisterStrategy.is(strategy)) throw new TypeError("Invalid RegisterStrategy.");
	}
}
