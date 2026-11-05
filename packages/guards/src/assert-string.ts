import { isString } from "./is-string";

export function assertString(value: unknown, message?: string): asserts value is string {
	if (!isString(value)) throw new TypeError(message ?? "Expected a string.");
}
