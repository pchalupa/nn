import { ArraySchema } from "./array-schema";
import { BooleanSchema } from "./boolean-schema";
import { EnumerationSchema } from "./enumeration-schema";
import { NumberSchema } from "./number-schema";
import { ObjectSchema } from "./object-schema";
import type { Schema } from "./schema";
import { StringSchema } from "./string-schema";

export type { InferStateType, Schema } from "./schema";

export function string(): StringSchema {
	return new StringSchema();
}

export function number(): NumberSchema {
	return new NumberSchema();
}

export function boolean(): BooleanSchema {
	return new BooleanSchema();
}

export function enumeration<const Literals extends readonly [string, ...string[]]>(
	...literals: Literals
): EnumerationSchema<Literals> {
	return new EnumerationSchema(literals);
}

export function object<Properties extends Record<string, Schema>>(properties: Properties): ObjectSchema<Properties> {
	return new ObjectSchema(properties);
}

export function array<Item extends Schema>(items: Item): ArraySchema<Item> {
	return new ArraySchema(items);
}
