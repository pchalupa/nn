import { isObject } from "./is-object";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (!isObject(value)) return false;

	const prototype = Object.getPrototypeOf(value);

	return prototype === Object.prototype || prototype === null;
}
