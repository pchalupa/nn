import { ArraySchema } from "./array-schema";
import { BooleanSchema } from "./boolean-schema";
import { EnumerationSchema } from "./enumeration-schema";
import { NumberSchema } from "./number-schema";
import { ObjectSchema } from "./object-schema";
import type { Schema } from "./schema";
import { StringSchema } from "./string-schema";

export type { InferStateType, Schema } from "./schema";

/**
 * Describes a string.
 *
 * @example
 * const title = string().describe("Ticket title.");
 */
export function string(): StringSchema {
	return new StringSchema();
}

/**
 * Describes a number.
 *
 * @example
 * const algorithm = number().describe("COSE algorithm identifier.");
 */
export function number(): NumberSchema {
	return new NumberSchema();
}

/**
 * Describes a boolean.
 *
 * @example
 * const archived = boolean().describe("Hidden from the board when true.");
 */
export function boolean(): BooleanSchema {
	return new BooleanSchema();
}

/**
 * Describes one of a fixed list of string literals.
 *
 * @param literals Allowed values. The literal types are kept, so you don't need `as const`.
 *
 * @example
 * const status = enumeration("todo", "in-progress", "done");
 *
 * type Status = InferStateType<typeof status>; // "todo" | "in-progress" | "done"
 */
export function enumeration<const Literals extends readonly [string, ...string[]]>(
	...literals: Literals
): EnumerationSchema<Literals> {
	return new EnumerationSchema(literals);
}

/**
 * Describes an object with a fixed set of properties.
 *
 * @example
 * const schema = object({
 * 	language: enumeration("en", "cs"),
 * 	tickets: array(object({ id: string(), title: string() })),
 * });
 */
export function object<Properties extends Record<string, Schema>>(properties: Properties): ObjectSchema<Properties> {
	return new ObjectSchema(properties);
}

/**
 * Describes a list of items of the same schema.
 *
 * @example
 * const tags = array(object({ name: string() }));
 */
export function array<Item extends Schema>(items: Item): ArraySchema<Item> {
	return new ArraySchema(items);
}
