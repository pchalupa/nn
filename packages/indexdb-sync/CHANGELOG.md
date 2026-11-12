# @nn/indexdb-sync

## 4.1.1

### Patch Changes

- Updated dependencies [be7c2b2]
- Updated dependencies [be7c2b2]
  - @nn/store@3.1.2
  - @nn/entities@4.0.0
  - @nn/sync-engine@4.1.1

## 4.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

### Patch Changes

- 23da839: Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
- Updated dependencies [23da839]
- Updated dependencies [23da839]
- Updated dependencies [63c2cc2]
- Updated dependencies [63c2cc2]
  - @nn/entities@3.1.0
  - @nn/observable@3.1.0
  - @nn/store@3.1.0
  - @nn/sync-engine@4.1.0

## 4.0.0

### Major Changes

- bd887fa: Sync engines stop with `dispose()` instead of `detach()`, since nothing attaches them anymore.

  - `sync.detach()` becomes `sync.dispose()`, and `sync.detached` becomes `sync.disposed`.
  - `SyncState.Detached` becomes `SyncState.Disposed`, and its value changes from `"detached"` to `"disposed"`.

  Custom engines that extend `SyncEngine` call `this.session.reopen()` instead of `this.session.reconnect()` to close and open a connected transport again. It still does nothing unless the engine is connected.

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.
- Updated dependencies [bd887fa]
- Updated dependencies [8abc710]
- Updated dependencies [8abc710]
  - @nn/sync-engine@4.0.0
  - @nn/entities@3.0.1
  - @nn/observable@3.0.2
  - @nn/store@3.0.1

## 3.0.0

### Major Changes

- 5d1e50e: Replace static `attach()` factories with public constructors and explicit `connect()` calls. Engines stay idle after construction, so listeners can be registered before synchronization starts. IndexedDB and Broadcast constructors keep `"nn-default"` as the default database or channel name.

  Replace `const sync = Engine.attach(store, options)` with:

  ```ts
  const sync = new Engine(store, options);

  sync.connect();
  ```

- 5d1e50e: Sync engines expose their connection lifecycle and failures directly, through `onStateChange` and `onError`, instead of `session` and `delegate`.

  - `sync.session.retry()` and `sync.session.detach()` become `sync.retry()` and `sync.detach()`. `sync.session.state`, `connected`, `disconnected` and the other state flags become `sync.state`, `sync.connected` and so on.
  - `sync.session.changes.subscribe(listener)` becomes `sync.onStateChange(listener)`.
  - `sync.delegate = { syncEngineDidFail: (engine, error) => … }` becomes `sync.onError((error) => …)`. Any number of listeners can subscribe, at any time. With none, failures are dropped.
  - `SessionState` is exported as `SyncState`, and `SyncEngineDelegate` is removed.

  Custom engines that extend `SyncEngine` still drive `this.session`, which is now protected. They report failures with `this.errors.notify(error)` instead of `this.delegate?.syncEngineDidFail(this, error)`.

### Patch Changes

- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
  - @nn/sync-engine@3.0.0
  - @nn/observable@3.0.1
  - @nn/store@3.0.0

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
