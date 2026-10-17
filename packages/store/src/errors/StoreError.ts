export class StoreError extends Error {
	public override readonly name: string = "StoreError";

	public static notPlain(): StoreError {
		return new StoreError("Store values must be plain objects, arrays and primitives.");
	}

	public static mismatch(expected: string): StoreError {
		return new StoreError(`Store.update() produced a value that needs ${expected}.`);
	}

	public static duplicateKey(key: string): StoreError {
		return new StoreError(`Two rows share the key "${key}".`);
	}

	public static persistence(name: string, cause: unknown): StoreError {
		return new StoreError(`Invalid persisted state for "${name}".`, { cause });
	}
}
