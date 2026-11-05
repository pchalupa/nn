import { isString } from "./is-string";

export function assertString(value: unknown): asserts value is string {
	if (!isString(value)) throw new TypeError("Expected a string.");
}
