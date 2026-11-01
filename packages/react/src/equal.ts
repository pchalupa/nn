import { isArray } from "@nn/guards/isArray";
import { isPlainObject } from "@nn/guards/isPlainObject";

export function equal(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;

	if (isArray(left) && isArray(right)) return equalArrays(left, right);

	if (isPlainObject(left) && isPlainObject(right)) return equalObjects(left, right);

	return false;
}

function equalArrays(left: readonly unknown[], right: readonly unknown[]): boolean {
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
