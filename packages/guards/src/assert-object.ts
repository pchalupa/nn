import { isObject } from "./is-object";

export function assertObject(value: unknown, message?: string): asserts value is Record<string, unknown> {
	if (!isObject(value)) throw new TypeError(message ?? "Expected an object.");
}
