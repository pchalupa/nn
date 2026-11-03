---
"@nn/store": major
---

Creates a `Store` synchronously from a schema and leaves persistence to separate sync engines.

`Store.fromSchema()` is removed, and the constructor takes only the schema. `Store` no longer accepts a repository or a remote, so it no longer restores or persists anything by itself. Persist a store by attaching `RepositorySync` from the new `@nn/repository-sync` package.

```ts
// Before
const store = await Store.fromSchema({ schema, repository });

// After
import { RepositorySync } from "@nn/repository-sync";

const store = new Store(schema);
const sync = RepositorySync.attach(store, repository);
```

The store is usable at once with the schema defaults, and stored values merge in when the restore finishes. Await `sync.restored` if you need the restored state.

`Store` also exposes the `schema` it was built from, and `observe(observer)`, which calls the observer with the set of changed entities on every commit and returns an unsubscribe function. `subscribe` is unchanged.
