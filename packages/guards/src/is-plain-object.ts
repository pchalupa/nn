import { isObject } from "./is-object";

/** Object with an `Object.prototype` or `null` prototype. Arrays and class instances don't pass. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (!isObject(value)) return false;

	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}
