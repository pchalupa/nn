---
"@nn/schema": minor
---

Adds a static `is` type guard to every schema class, so you can branch on a schema shape and keep the type.

`ArraySchema.is(value)` takes an `unknown` value and narrows it to `ArraySchema`:

```ts
import { ArraySchema } from "@nn/schema/ArraySchema";

if (ArraySchema.is(shape)) {
	shape.items; // Schema
}
```

`Schema.is` matches any schema, and `StringSchema`, `NumberSchema`, `BooleanSchema`, `ObjectSchema` and `ArraySchema` override it with their own. The guards check the instance, not the `type` field, so a plain object that looks like a schema does not pass.

Every schema class is now a package export, so you can import the class itself from `@nn/schema/StringSchema`, `@nn/schema/NumberSchema`, `@nn/schema/BooleanSchema`, `@nn/schema/ObjectSchema`, `@nn/schema/ArraySchema` and `@nn/schema/Schema`. The root export is unchanged.
