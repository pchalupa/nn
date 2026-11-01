import { isArray } from "./isArray";

export function assertArray(value: unknown): asserts value is readonly unknown[] {
	if (!isArray(value)) throw new TypeError("Expected an array.");
}
