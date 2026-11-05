import { isPlainObject } from "./is-plain-object";

export function assertPlainObject(value: unknown, message?: string): asserts value is Record<string, unknown> {
	if (!isPlainObject(value)) throw new TypeError(message ?? "Expected a plain object.");
}
