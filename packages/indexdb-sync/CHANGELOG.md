# @nn/indexdb-sync

## 2.0.0

### Major Changes

- a36eeaf: `IndexDbSync.attach(store, name)` returns the engine right away and loads the stored state in the background, so the app doesn't wait for IndexedDB before it renders. The store shows its default values until the stored state merges in. Edits made in the meantime merge with it and are written once the database opens.

  Remove the `await` in front of the call. Code that keeps it still compiles, but it no longer waits for the stored state.

  ```ts
  // before
  const sync = await IndexDbSync.attach(store, "settings");

  // after
  const sync = IndexDbSync.attach(store, "settings");
  ```

  A failure to open or read the database is reported through `syncEngineDidFail` on `sync.delegate`.

  Stop syncing with `sync.session.detach()` instead of `sync.detach()`.

### Patch Changes

- a36eeaf: When another tab upgrades the IndexedDB database, for example after a deploy adds a field to the schema, the engine reopens the database, pulls the stored state and pushes every field, instead of failing on every later write. When another tab deletes the database, the engine stops syncing and doesn't create the database again. Closing the database explicitly reports neither.

  Reopening no longer fails with `VersionError` while the other tab's upgrade is still running.

- Updated dependencies [a36eeaf]
- Updated dependencies [a36eeaf]
- Updated dependencies [dbd5b8a]
  - @nn/store@2.1.0
  - @nn/sync-engine@2.0.0

## 1.0.0

### Major Changes

- 95d6d01: Adds `IndexDbSync`, a sync engine that persists a store to [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). It replaces `@nn/repository`, `@nn/indexdb-repository` and `@nn/repository-sync`, which get no further releases.

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

### Patch Changes

- Updated dependencies [56346fc]
  - @nn/entities@3.0.0
