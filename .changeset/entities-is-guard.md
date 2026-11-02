---
"@nn/entities": minor
---

Adds a static `is` type guard to every entity class, so you can branch on an entity kind and keep the type.

`LWWMap.is(value)` takes an `unknown` value and narrows it to `LWWMap`:

```ts
import { LWWMap } from "@nn/entities/kinds/LWWMap";

if (LWWMap.is(entity)) {
	entity.get("title"); // Entity | undefined
}
```

`Entity.is` matches any entity, and `LWWRegister`, `LWWMap` and `RGA` override it with their own. The guards check the instance, so a plain object that looks like an entity does not pass.

Each class also has a static `assert` that narrows the same way but throws a `TypeError` when the value is not that entity:

```ts
LWWMap.assert(entity);
entity.get("title"); // Entity | undefined
```
