import { isString } from "@nn/guards/is-string";
import { Time } from "@nn/time";

import type { Encoded } from "./codable";
import { Entity } from "./entity";

/**
 * Single value where the write with the later {@link Time} wins.
 *
 * @example
 * const local = new LWWRegister("en", "language");
 * const remote = new LWWRegister("cs", "language");
 *
 * local.merge(remote);
 * local.current; // "cs", the later write
 */
export class LWWRegister<Value> extends Entity<Value> {
	private value: Value;
	public timestamp: Time;

	constructor(value: Value, key?: string, timestamp: Time = Time.now()) {
		super("LWWRegister", key);

		this.value = value;
		this.timestamp = timestamp;
	}

	public get [Symbol.toStringTag](): string {
		return "LWWRegister";
	}

	/** Stamps the value with `Time.now()` */
	public set current(value: Value) {
		this.value = value;
		this.timestamp = Time.now();
		this.didChange();
	}

	public get current(): Value {
		return this.value;
	}

	/** Keeps the later write. When the local write wins, it's copied into `remote` too. */
	public merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.value = this.value;
			remote.timestamp = this.timestamp;

			remote.didChange();
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

		if (!("timestamp" in metadata) || !isString(metadata.timestamp)) {
			throw new TypeError("Invalid encoded LWWRegister.");
		}
	}
}
