---
"@nn/cache": major
---

Adds `@nn/cache`, with two caches for values derived from other state.

`InvalidatableCache` holds one value that its owner invalidates when the source changes:

```ts
import { InvalidatableCache } from "@nn/cache/invalidatable-cache";

const cachedItems = new InvalidatableCache<readonly Row[]>();

cachedItems.ensure(() => Array.from(items.values()));
cachedItems.invalidate();
```

`VersionedCache` keeps one value per object and loads it again when the object's version changes:

```ts
import { VersionedCache } from "@nn/cache/versioned-cache";

const cachedProjections = new VersionedCache<Entity, object>();

cachedProjections.ensure(entity, entity.revision, project);
```
