import { InvalidatableCache } from "@nn/cache/invalidatable-cache";

import { TimestampMalformedError } from "./errors/timestamp-malformed-error";
import { COUNTER_DIGITS, GlobalTime } from "./global-time";

const TIMESTAMP_DELIMITER = "+" as const;
const TIMESTAMP_PATTERN =
	/^((?:\d{4}|[+-]\d{6})-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2}))\+([0-9a-f]{5})\+([^+]+)$/;

/** Represents time using a Hybrid Logical Clock (HLC) model */
export class Time extends GlobalTime {
	/** Physical time in milliseconds */
	private readonly time: number;
	/** Logical time */
	private readonly counter: number;
	/** Identity of the replica that minted this time */
	private readonly replicaId: string;
	private readonly cachedTimeString = new InvalidatableCache<string>();

	constructor(time: number, counter: number, replicaId: string = GlobalTime.replicaId) {
		super();

		this.time = time;
		this.counter = counter;
		this.replicaId = replicaId;
	}

	/** Returns the physical time in milliseconds */
	public getTime(): number {
		return this.time;
	}

	/** Returns the logical time */
	public getCounter(): number {
		return this.counter;
	}

	/**
	 * Returns the timestamp as a string
	 * @example '2024-11-10T12:39:10.776Z+00002+9f1d0b07-7a3c-4d1e-9f52-6c2a4e8b1d30'
	 */
	public toString(): string {
		return this.cachedTimeString.ensure(() => {
			const time = new Date(this.time).toISOString();
			const counter = this.counter.toString(16).padStart(COUNTER_DIGITS, "0");

			return [time, counter, this.replicaId].join(TIMESTAMP_DELIMITER);
		});
	}

	/**
	 * Orders this time against another by physical time, counter, then replica id.
	 *
	 * @example
	 * events.sort((left, right) => left.time.compare(right.time));
	 */
	public compare(other: Time): number {
		if (this.time !== other.time) return this.time - other.time;

		if (this.counter !== other.counter) return this.counter - other.counter;

		if (this.replicaId === other.replicaId) return 0;

		return this.replicaId < other.replicaId ? -1 : 1;
	}

	/** Returns true if this time is after another time */
	public isAfter(other: Time): boolean {
		return this.compare(other) > 0;
	}

	/** Return epoch time */
	public static epoch(): Time {
		return new Time(0, 0, "00000000-0000-0000-0000-000000000000");
	}

	/**
	 * Returns the current time, strictly after the previous one even within the same millisecond.
	 *
	 * @throws {CounterOverflowError} When the counter runs out before the wall clock moves forward.
	 */
	public static now(): Time {
		GlobalTime.tick();

		return new Time(GlobalTime.time, GlobalTime.counter);
	}

	/**
	 * Returns a time from a timestamp
	 *
	 * @throws {TimestampMalformedError} When the timestamp doesn't match the expected format.
	 *
	 * @example
	 * const time = Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002+9f1d0b07-7a3c-4d1e-9f52-6c2a4e8b1d30");
	 *
	 * time.getTime(); // 1731242350776
	 * time.getCounter(); // 2
	 */
	public static fromTimestamp(timestamp: string): Time {
		const [, physical, logical, replicaId] = timestamp.match(TIMESTAMP_PATTERN) ?? [];

		if (!physical || !logical || !replicaId) throw new TimestampMalformedError(timestamp);

		const time = Date.parse(physical);
		const counter = Number.parseInt(logical, 16);

		if (!Number.isFinite(time) || !Number.isFinite(counter)) {
			throw new TimestampMalformedError(timestamp);
		}

		const parsed = new Time(time, counter, replicaId);

		parsed.cachedTimeString.ensure(() => timestamp);

		return parsed;
	}
}
