/** Creates identities locally */
export class ID {
	/**
	 * Returns a UUID v4 string
	 * @example ID.create(); // "9f1d0b07-7a3c-4d1e-9f52-6c2a4e8b1d30"
	 */
	public static create(): string {
		return globalThis.crypto.randomUUID();
	}
}
