/** Creates identities locally */
export class ID {
	/** Returns a UUID v4 string */
	public static create(): string {
		return globalThis.crypto.randomUUID();
	}
}
