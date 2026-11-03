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

The store is usable at once with the schema defaults, and stored values merge in when the bootstrap finishes. Set `sync.delegate` if you need to know when the bootstrap has finished.

`Store` also exposes the `schema` it was built from and two channels. `store.updates` notifies its observers after every commit, and `store.changes` passes them the set of changed entities first. `store.subscribe(listener)` is replaced by `store.updates.subscribe(listener)`.
