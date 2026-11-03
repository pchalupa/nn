---
"@nn/repository-sync": major
---

Adds `RepositorySync`, a sync engine that restores a store from a repository and persists its changes.

Attach it with `RepositorySync.attach(store, repository)`, which returns a `Sync` from `@nn/sync`. The restore runs in the background and merges stored values into the store when they arrive. Edits made in the meantime are written only after the merge, so they never overwrite stored data. Await `sync.restored` if you need the restored state, and call `sync.detach()` to stop.

```ts
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

const sync = RepositorySync.attach(store, new IndexDbRepository());
```

`RepositorySync` persists only changes reported after it attaches. `restored` rejects when the restore fails, and each failure is also logged with `console.error`. After an `init` failure the engine persists nothing for its lifetime, and a field that failed to restore is never written by that engine.

Each store needs its own repository. Records are keyed by field name, so two stores sharing one database would overwrite each other's fields. Give each `IndexDbRepository` its own database name, for example `new IndexDbRepository("settings")`.
