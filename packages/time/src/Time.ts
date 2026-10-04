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
	 * @example '2024-11-10T12:39:10.776Z+00002'
	 */
	public toString(): string {
		const time = new Date(this.time).toISOString();
		const counter = this.counter.toString(16).padStart(COUNTER_DIGITS, "0");

		return [time, counter].join(TIMESTAMP_DELIMITER);
	}

	/** Returns true if this time is after another time */
	public isAfter(other: Time): boolean {
		return this.time > other.time || (this.time === other.time && this.counter > other.counter);
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

		if (!physical || !logical) throw new TimestampMalformedError(timestamp);

		const time = Date.parse(physical);
		const counter = Number.parseInt(logical, 16);

		if (Number.isNaN(time)) throw new TimestampMalformedError(timestamp);

		return new Time(time, counter);
	}
}
