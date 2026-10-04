import { TimeError } from "./TimeError";

export class TimestampMalformedError extends TimeError {
	override readonly name = "TimeStampMalformedError";

	constructor(timestamp: string) {
		super(
			`Timestamp ${JSON.stringify(timestamp)} is malformed. Expected "<ISO 8601 time>+<hex counter>", for example "2024-11-10T12:39:10.776Z+00002".`,
		);
	}
}
