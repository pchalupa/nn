---
"@nn/react": major
---

Makes `createStore(schema)` return a store synchronously and `use()` take that store directly, so components read and write without a Suspense boundary.

`createStore()` now takes only the schema and returns the `Store` at once. It no longer accepts a repository or a remote, and `use()` no longer accepts a promise of a store. You don't need to install `@nn/store` yourself. Attach persistence with `RepositorySync.attach(store, repository)` from `@nn/repository-sync`. Components render at once with the schema defaults and rerender when restored data is merged in.

```ts
// Before
import { createStore, use } from "@nn/react";

const { useRead, useUpdate } = use(createStore({ schema, repository }));

// After
import { createStore, use } from "@nn/react";
import { RepositorySync } from "@nn/repository-sync";

const store = createStore(schema);
const sync = RepositorySync.attach(store, repository);
const { useRead, useUpdate } = use(store);
```

Keep `sync` if you want to `await sync.restored` or call `sync.detach()`.
