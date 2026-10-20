import { StoreError } from "./errors/StoreError";

export type View<Value> = { readonly [Key in keyof Value]: View<Value[Key]> };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clone(value: unknown): unknown {
	try {
		return structuredClone(value);
	} catch {
		throw StoreError.notPlain();
	}
}

function freeze(value: unknown): void {
	if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
	Object.freeze(value);
	for (const child of Object.values(value)) freeze(child);
}

export function snapshot(value: unknown): unknown {
	const result = clone(value);
	freeze(result);
	return result;
}
