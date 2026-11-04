import type { Entity } from "@nn/entities/entity";
import type { Schema } from "@nn/schema";
import { ArraySchema } from "@nn/schema/array-schema";
import { BooleanSchema } from "@nn/schema/boolean-schema";
import { EnumerationSchema } from "@nn/schema/enumeration-schema";
import { NumberSchema } from "@nn/schema/number-schema";
import { ObjectSchema } from "@nn/schema/object-schema";
import { StringSchema } from "@nn/schema/string-schema";

import { ListStrategy } from "./list-strategy";
import { MapStrategy } from "./map-strategy";
import { RegisterStrategy } from "./register-strategy";
import type { Strategy } from "./strategy";

export function createReconciliationStrategy(schema: Schema, entities: WeakMap<object, Entity>): Strategy {
	if (ObjectSchema.is(schema)) {
		const fields = new Map<string, Strategy>();

		for (const name in schema.properties) {
			fields.set(name, createReconciliationStrategy(schema.properties[name], entities));
		}

		return new MapStrategy(fields);
	}

	if (ArraySchema.is(schema)) {
		const items = createReconciliationStrategy(schema.items, entities);

		return new ListStrategy(items, entities);
	}

	if (StringSchema.is(schema)) return new RegisterStrategy("");

	if (NumberSchema.is(schema)) return new RegisterStrategy(0);

	if (BooleanSchema.is(schema)) return new RegisterStrategy(false);

	if (EnumerationSchema.is(schema)) return new RegisterStrategy(schema.literals.at(0));

	throw new TypeError(`Unsupported schema type "${schema.type}".`);
}
