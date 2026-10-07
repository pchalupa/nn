import { TimeError } from "./TimeError";

/** Raised when a replica identity cannot survive a round trip through a timestamp. */
export class ReplicaIdMalformedError extends TimeError {
	public override readonly name = "ReplicaIdMalformedError";

	constructor(replicaId: string) {
		super(`Replica ID ${JSON.stringify(replicaId)} is malformed. Expected a non-empty string holding no "+".`);
	}
}
