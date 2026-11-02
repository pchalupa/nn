import { TimeError } from "./TimeError";

export class TimestampMalformedError extends TimeError {
	public override readonly name = "TimestampMalformedError";

	constructor(timestamp: string) {
		super(
			`Timestamp ${JSON.stringify(timestamp)} is malformed. Expected "<ISO 8601 time>+<hex counter>+<replica>", for example "2024-11-10T12:39:10.776Z+00002+9f1d0b07-7a3c-4d1e-9f52-6c2a4e8b1d30".`,
		);
	}
}
