---
"@nn/schema": minor
"@nn/store": minor
---

Adds an `enumeration()` schema for a field that holds one of a fixed set of strings.

```ts
import { enumeration, object } from "@nn/schema";

const ticket = object({
	status: enumeration("todo", "in-progress", "done"),
});
```

`InferStateType` types the field as `"todo" | "in-progress" | "done"`, so reads return the union and updates only accept those values. It needs at least one literal. `EnumerationSchema` is exported from `@nn/schema/EnumerationSchema` with a static `is` guard and exposes the list as `literals`.

The store supports the new schema and fills in the first literal when a field has none.
