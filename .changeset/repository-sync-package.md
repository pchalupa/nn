---
"@nn/repository-sync": major
---

Adds `RepositorySync`, a sync engine that restores a store from a repository and persists its changes.

Attach it with `RepositorySync.attach(store, repository)`. The bootstrap runs in the background: it calls the repository's `init()`, then reads each field and merges the stored value into the store. Call `sync.detach()` to stop persisting and close the repository.

```ts
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

const sync = RepositorySync.attach(store, new IndexDbRepository());
```

Every change is written right away, including edits made before the bootstrap finishes. With `IndexDbRepository`, an edit made before `init()` finishes fails, and an edit to a field that isn't restored yet overwrites its stored value. Restored values are written back too. If `init()` or a read fails, `RepositorySync` detaches itself and stops persisting. Failures aren't reported yet, and a failed write surfaces as an unhandled promise rejection.

Each store needs its own repository. Records are keyed by field name, so two stores sharing one database would overwrite each other's fields. Give each `IndexDbRepository` its own database name, for example `new IndexDbRepository("settings")`.
