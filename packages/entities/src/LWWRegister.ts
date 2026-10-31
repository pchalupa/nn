import { Time } from "@nn/time";

import type { Encoded } from "./Codable";
import { Entity } from "./Entity";

export class LWWRegister<Value> extends Entity<Value> {
	constructor(
		private value: Value,
		key?: string,
		public timestamp = Time.now(),
	) {
		super(key);
	}

	public get [Symbol.toStringTag](): string {
		return "LWWRegister";
	}

	public set current(value: Value) {
		this.value = value;
		this.timestamp = Time.now();
		this.didChange();
	}

	public get current(): Value {
		return this.value;
	}

	public merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.value = this.value;
			remote.timestamp = this.timestamp;
		} else if (remote.timestamp.isAfter(this.timestamp)) {
			this.value = remote.value;
			this.timestamp = remote.timestamp;

			this.didChange();
		}

		return this;
	}

	public static decode(encoded: Encoded<unknown, { kind: string; timestamp: string }>): LWWRegister<unknown> {
		return new LWWRegister(encoded.data, encoded.key, Time.fromTimestamp(encoded.metadata.timestamp));
	}

	public encode(): Encoded<Value, { kind: string; timestamp: string }> {
		return {
			key: this.key,
			data: this.value,
			metadata: { kind: this.constructor.name, timestamp: this.timestamp.toString() },
		};
	}
}
