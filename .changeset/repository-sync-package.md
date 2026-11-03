---
"@nn/repository-sync": major
---

Adds `RepositorySync`, a sync engine that restores a store from a repository and persists its changes.

Attach it with `RepositorySync.attach(store, repository)`. The bootstrap runs in the background and merges stored values into the store when they arrive. Edits made in the meantime are written only after the merge, so they never overwrite stored data. Call `sync.detach()` to stop. Detaching also closes the repository if it has a `close()` method, as `IndexDbRepository` does.

```ts
import { IndexDbRepository } from "@nn/indexdb-repository";
import { RepositorySync } from "@nn/repository-sync";

const sync = RepositorySync.attach(store, new IndexDbRepository());

sync.delegate = {
	syncEngineDidBootstrap: () => console.info("Restored"),
	syncEngineDidFail: (_sync, error) => console.warn("Persistence failed", error),
};
```

`RepositorySync` persists only changes reported after it attaches. If the repository's `init` fails, it detaches itself and persists nothing, and `syncEngineDidBootstrap` is never called. A field that failed to restore is never written by that engine. Each failure goes to `syncEngineDidFail`.

Each store needs its own repository. Records are keyed by field name, so two stores sharing one database would overwrite each other's fields. Give each `IndexDbRepository` its own database name, for example `new IndexDbRepository("settings")`.
