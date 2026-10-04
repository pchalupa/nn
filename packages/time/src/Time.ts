import { ID } from "@nn/id";

import { CounterOverflowError } from "./errors/CounterOverflowError";
import { TimestampMalformedError } from "./errors/TimestampMalformedError";

const TIMESTAMP_DELIMITER = "+" as const;
const COUNTER_DIGITS = 5;
const MAX_COUNTER = 16 ** COUNTER_DIGITS - 1;

class GlobalTime {
	/** Physical time in milliseconds */
	protected static time = 0;
	/** Logical time */
	protected static counter = 0;
	/** Identity of the replica this process stamps onto every time it mints */
	protected static replicaId = ID.create();

	/**
	 * Moves the shared clock to the present, keeping the logical time inside the timestamp field.

	* @throws {CounterOverflowError} When the logical time has nowhere left to grow.
	 */
	protected static tick(): void {
		const currentTime = Date.now();

		if (currentTime > GlobalTime.time) {
			GlobalTime.time = currentTime;
			GlobalTime.counter = 0;
		} else {
			if (GlobalTime.counter >= MAX_COUNTER) throw new CounterOverflowError(GlobalTime.counter + 1, MAX_COUNTER);

			GlobalTime.counter++;
		}
	}
}

/** Represents time using a Hybrid Logical Clock (HLC) model */
export class Time extends GlobalTime {
	constructor(
		/** Physical time in milliseconds */
		private time: number,
		/** Logical time */
		private counter: number,
		/** Identity of the replica that minted this time */
		private replicaId: string = GlobalTime.replicaId,
	) {
		super();
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
		const time = new Date(this.time).toISOString();
		const counter = this.counter.toString(16).padStart(COUNTER_DIGITS, "0");

		return [time, counter, this.replicaId].join(TIMESTAMP_DELIMITER);
	}

	/** Orders this time against another. */
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

	/** Returns the current time */
	public static now(): Time {
		GlobalTime.tick();

		return new Time(GlobalTime.time, GlobalTime.counter);
	}

	/** Returns a time from a timestamp */
	public static fromTimestamp(timestamp: string): Time {
		const parts = timestamp.split(TIMESTAMP_DELIMITER);

		const physical = parts.at(0);
		const logical = parts.at(1);
		const replicaId = parts.at(2);

		if (!physical || !logical || !replicaId) throw new TimestampMalformedError(timestamp);

		const time = Date.parse(physical);
		const counter = Number.parseInt(logical, 16);

		if (Number.isNaN(time) || Number.isNaN(counter)) throw new TimestampMalformedError(timestamp);

		return new Time(time, counter, replicaId);
	}
}
