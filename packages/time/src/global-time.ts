import { ID } from "@goodstate/id";

import { CounterOverflowError } from "./errors/counter-overflow-error";
import type { Time } from "./time";

export const COUNTER_DIGITS = 5;

const MAX_COUNTER = 16 ** COUNTER_DIGITS - 1;

export class GlobalTime {
	/** Physical time in milliseconds */
	protected static time = 0;
	/** Logical time */
	protected static counter = 0;
	/** Identity of the replica this process stamps onto every time it mints */
	protected static replicaId: string = ID.create();

	/**
	 * Moves the shared clock to the present, keeping the logical time inside the timestamp field.
	 *
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

	/**
	 * Advances the clock to a newer remote time.
	 *
	 * @example
	 * Time.receive(Time.fromTimestamp(message.timestamp));
	 */
	public static receive(remote: Time): void {
		const time = remote.getTime();
		const counter = remote.getCounter();

		if (time > GlobalTime.time || (time === GlobalTime.time && counter > GlobalTime.counter)) {
			GlobalTime.time = time;
			GlobalTime.counter = counter;
		}
	}
}
