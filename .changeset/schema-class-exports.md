---
"@nn/schema": minor
---

Exports `ArraySchema`, `BooleanSchema`, `NumberSchema`, `ObjectSchema` and `StringSchema` as values from the `@nn/schema/ArraySchema`, `@nn/schema/BooleanSchema`, `@nn/schema/NumberSchema`, `@nn/schema/ObjectSchema` and `@nn/schema/StringSchema` subpaths. The package root no longer exports them.

Their `isArraySchema`, `isBooleanSchema`, `isNumberSchema`, `isObjectSchema` and `isStringSchema` guards were unreachable outside the package, so telling one shape from another meant comparing the `type` string, which does not narrow. Import the classes from their subpaths instead of the package root.

```ts
import { ArraySchema } from "@nn/schema/ArraySchema";

if (ArraySchema.isArraySchema(shape)) shape.items; // narrowed
```
