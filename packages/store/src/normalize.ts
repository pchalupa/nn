import { ArraySchema, ObjectSchema, type Schema } from "@nn/schema";

import { StoreError } from "./errors/StoreError";
import { isPlainObject } from "./View";

export function normalizeObject(
	shape: ObjectSchema<Record<string, Schema>>,
	data: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(shape.properties).map(([key, property]) => [
			key,
			normalize(property, Object.hasOwn(data, key) ? data[key] : undefined),
		]),
	);
}

export function normalize(shape: Schema, value: unknown): unknown {
	if (ObjectSchema.isObjectSchema(shape)) {
		if (value === undefined) return normalizeObject(shape, {});
		if (isPlainObject(value)) return normalizeObject(shape, value);
	} else if (value === undefined) return undefined;
	else if (ArraySchema.isArraySchema(shape)) {
		if (Array.isArray(value)) return value.map((item: unknown) => normalize(shape.items, item));
	} else if (typeof value === shape.type) return value;
	throw new TypeError("Store state does not match its schema.");
}

export function plainRow(value: unknown, key: string): Record<string, unknown> {
	if (!isPlainObject(value)) throw StoreError.mismatch("a record");
	return { ...value, key };
}
