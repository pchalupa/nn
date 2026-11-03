import { Time } from "@nn/time";

import type { Encoded } from "./Codable";
import { Entity } from "./Entity";

export class LWWRegister<Value> extends Entity<Value> {
	public static override readonly kind = "LWWRegister";

	constructor(
		private value: Value,
		key?: string,
		public timestamp = Time.now(),
	) {
		super("LWWRegister", key);
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

	public encode(): Encoded<Value, { kind: string; timestamp: string }> {
		return {
			key: this.key,
			data: this.value,
			metadata: { kind: this.kind, timestamp: this.timestamp.toString() },
		};
	}

	public static decode(encoded: Encoded): LWWRegister<unknown> {
		LWWRegister.assertEncoded(encoded);

		return new LWWRegister(encoded.data, encoded.key, Time.fromTimestamp(encoded.metadata.timestamp));
	}

	public static override is(entity: unknown): entity is LWWRegister<unknown> {
		return entity instanceof LWWRegister;
	}

	public static override assert(entity: unknown): asserts entity is LWWRegister<unknown> {
		if (!LWWRegister.is(entity)) throw new TypeError("Invalid LWWRegister.");
	}

	private static assertEncoded(
		encoded: Encoded,
	): asserts encoded is Encoded<unknown, { kind: string; timestamp: string }> {
		const { metadata } = encoded;

		if (!("timestamp" in metadata) || typeof metadata.timestamp !== "string") {
			throw new TypeError("Invalid encoded LWWRegister.");
		}
	}
}
