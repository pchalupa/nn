import { isObject } from "./is-object";

export function assertObject(value: unknown): asserts value is Record<string, unknown> {
	if (!isObject(value)) throw new TypeError("Expected an object.");
}
