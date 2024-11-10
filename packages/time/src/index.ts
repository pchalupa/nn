const TIMESTAMP_DELIMITER = '+' as const;

class GlobalTime {
	/** Physical  time in milliseconds */
	protected static time: number = 0;
	/** Logical time */
	protected static counter: number = 0;
}

/** Represents time using a Hybrid Logical Clock (HLC) model */
export class Time extends GlobalTime {
	/** Physical time in milliseconds */
	private time: number;
	/** Logical time */
	private counter: number;

	constructor(time: number, counter: number) {
		super();

		this.time = time;
		this.counter = counter;
	}

	/** Returns the physical time in milliseconds */
	public getTime(): number {
		return this.time;
	}

	/** Returns the logical time */
	public getCounter(): number {
		return this.counter;
	}

	/** Returns the timestamp as a string */
	public toString(): string {
		const time = new Date(this.time).toISOString();
		const counter = ('00000' + this.counter.toString(16)).slice(-5);

		return [time, counter].join(TIMESTAMP_DELIMITER);
	}

	/** Returns true if this time is after another time */
	public isAfter(other: Time): boolean {
		return this.time > other.time || (this.time === other.time && this.counter > other.counter);
	}

	/** Returns the current time */
	public static now(): Time {
		const pt = Date.now();

		if (pt > GlobalTime.time) {
			GlobalTime.time = pt;
			GlobalTime.counter = 0;
		} else {
			GlobalTime.counter++;
		}

		return new Time(GlobalTime.time, GlobalTime.counter);
	}

	/** Returns a time from a timestamp */
	public static fromTimestamp(timestamp: string): Time {
		const match = timestamp.split(TIMESTAMP_DELIMITER);
		const time = new Date(match?.at(0) ?? 0).getTime();
		const counter = parseInt(match?.at(1) ?? '0', 16);

		return new Time(time, counter);
	}
}
