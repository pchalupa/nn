function isComparable(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false;
	if (Array.isArray(value)) return true;
	const prototype: unknown = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export function equal(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (!isComparable(left) || !isComparable(right)) return false;
	if (Array.isArray(left) !== Array.isArray(right)) return false;
	if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false;
	const keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
}
