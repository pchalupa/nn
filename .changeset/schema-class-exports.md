---
"@nn/schema": minor
---

Exports `ArraySchema`, `ObjectSchema` and `StringSchema` as values, not only as types.

Their `isArraySchema`, `isObjectSchema` and `isStringSchema` guards were unreachable outside the package, so telling one shape from another meant comparing the `type` string, which does not narrow.

```ts
import { ArraySchema } from "@nn/schema";

if (ArraySchema.isArraySchema(shape)) shape.items; // narrowed
```
