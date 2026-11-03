---
"@nn/indexdb-sync": major
---

Adds `IndexDbSync`, a sync engine that persists a store to [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). It replaces `@nn/repository`, `@nn/indexdb-repository` and `@nn/repository-sync`, which get no further releases.

Attach it with `IndexDbSync.attach(store, name)`. It restores each field from the database named `name` and saves every change made after it attaches. `name` defaults to `"nn-default"`. Call `sync.detach()` to stop saving and close the database.

To migrate, install `@nn/indexdb-sync`, remove the three old packages and replace the repository and its engine with one call:

```ts
// before
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

RepositorySync.attach(store, new IndexDbRepository("settings"));

// after
import { IndexDbSync } from "@nn/indexdb-sync";

IndexDbSync.attach(store, "settings");
```

`IndexDbSync` reads and writes the same database, object stores and values as `RepositorySync` with `IndexDbRepository`, so data stored before the update restores without a migration.

The `Repository` interface is removed. To persist somewhere other than IndexedDB, extend `SyncEngine` from `@nn/sync-engine`.
