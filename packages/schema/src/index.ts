import { ArraySchema } from "./ArraySchema";
import { BooleanSchema } from "./BooleanSchema";
import { NumberSchema } from "./NumberSchema";
import { ObjectSchema } from "./ObjectSchema";
import type { Schema } from "./Schema";
import { StringSchema } from "./StringSchema";

export type { ArraySchema } from "./ArraySchema";
export type { ObjectSchema } from "./ObjectSchema";
export type { Infer, Schema } from "./Schema";

export function string(): StringSchema {
	return new StringSchema();
}

export function number(): NumberSchema {
	return new NumberSchema();
}

export function boolean(): BooleanSchema {
	return new BooleanSchema();
}

export function object<Properties extends Record<string, Schema>>(properties: Properties): ObjectSchema<Properties> {
	return new ObjectSchema(properties);
}

export function array<Item extends Schema>(items: Item): ArraySchema<Item> {
	return new ArraySchema(items);
}
