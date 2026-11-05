import { isArray } from "./is-array";

export function assertArray(value: unknown, message?: string): asserts value is readonly unknown[] {
	if (!isArray(value)) throw new TypeError(message ?? "Expected an array.");
}
