import { TimeError } from "./TimeError";

/** Raised when the logical counter leaves the range the timestamp field holds. */
export class CounterOverflowError extends TimeError {
	public override readonly name = "CounterOverflowError";

	constructor(counter: number, max: number) {
		super(
			`Logical counter ${counter} is not an integer between 0 and ${max}. Reaching the upper bound means clock drift, not throughput.`,
		);
	}
}
