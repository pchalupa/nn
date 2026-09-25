---
"@nn/schema": minor
---

Adds a static type guard to every schema class, in the style of `Array.isArray`.

Each guard takes an `unknown` value and narrows it to that schema, so you can branch on a schema shape and keep the type:

```ts
import { ArraySchema } from "@nn/schema/ArraySchema";

if (ArraySchema.isArraySchema(shape)) {
	shape.items; // Schema
}
```

The guards are `StringSchema.isStringSchema`, `NumberSchema.isNumberSchema`, `BooleanSchema.isBooleanSchema`, `ObjectSchema.isObjectSchema` and `ArraySchema.isArraySchema`. They check the instance, not the `type` field, so a plain object that looks like a schema does not pass.

Every schema class is now a package export, so you can import the class itself from `@nn/schema/StringSchema`, `@nn/schema/NumberSchema`, `@nn/schema/BooleanSchema`, `@nn/schema/ObjectSchema`, `@nn/schema/ArraySchema` and `@nn/schema/Schema`. The root export is unchanged.
