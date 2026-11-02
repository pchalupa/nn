---
"@nn/schema": major
---

Exports every schema class from its own subpath and adds a static `is` type guard to each, so you can branch on a schema shape and keep the type.

```ts
import { ArraySchema } from "@nn/schema/ArraySchema";

if (ArraySchema.is(shape)) {
	shape.items; // Schema
}
```

Import `StringSchema`, `NumberSchema`, `BooleanSchema`, `ObjectSchema` and `ArraySchema` from `@nn/schema/<ClassName>`. `Schema.is` matches any schema. The guards check the instance, not the `type` field, so a plain object that looks like a schema does not pass.

The package root keeps the builders and the `Schema` type but no longer exports the `ArraySchema` and `ObjectSchema` types. `Infer` is renamed `InferStateType`:

```ts
import type { Infer } from "@nn/schema"; // before
import type { InferStateType } from "@nn/schema"; // after
```
