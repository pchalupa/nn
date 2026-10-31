export function equal(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;

	if (Array.isArray(left) && Array.isArray(right)) return equalArrays(left, right);

	if (isObject(left) && isObject(right)) return equalObjects(left, right);

	return false;
}

function equalArrays(left: unknown[], right: unknown[]): boolean {
	if (left.length !== right.length) return false;

	for (let i = 0; i < left.length; i++) {
		if (Object.hasOwn(left, i) !== Object.hasOwn(right, i)) return false;

		if (!equal(left[i], right[i])) return false;
	}

	return true;
}

function equalObjects(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
	if (
		Object.keys(left).length === Object.keys(right).length &&
		Object.keys(left).every((key) => equal(left[key], right[key]))
	) {
		return true;
	}

	return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object") return false;
	else if (value === null) return false;
	else if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) return true;

	return false;
}
