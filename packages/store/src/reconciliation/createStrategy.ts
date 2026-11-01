import type { Entity } from "@nn/entities/Entity";
import type { Schema } from "@nn/schema";
import { ArraySchema } from "@nn/schema/ArraySchema";
import { BooleanSchema } from "@nn/schema/BooleanSchema";
import { NumberSchema } from "@nn/schema/NumberSchema";
import { ObjectSchema } from "@nn/schema/ObjectSchema";
import { StringSchema } from "@nn/schema/StringSchema";

import { ListStrategy } from "./ListStrategy";
import { MapStrategy } from "./MapStrategy";
import { RegisterStrategy } from "./RegisterStrategy";
import type { Strategy } from "./Strategy";

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

	throw new TypeError(`Unsupported schema type "${schema.type}".`);
}
