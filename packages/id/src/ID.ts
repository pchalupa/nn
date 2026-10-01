/** Creates identities locally */
export class ID {
	/** Returns a UUID v4 string */
	static create(): string {
		return globalThis.crypto.randomUUID();
	}
}
