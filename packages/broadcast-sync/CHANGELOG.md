# @goodstate/broadcast-sync

## 7.0.1

### Patch Changes

- 60eb15a: All `@goodstate/*` packages now share one version number and are released together. Install the same version of every `@goodstate/*` package you use. Nothing in the API changed.
- Updated dependencies [60eb15a]
  - @goodstate/guards@7.0.1
  - @goodstate/sync-engine@7.0.1

## 6.0.0

### Major Changes

- a91d14d: The default database and channel name is now `goodstate-default` instead of `nn-default`. If you construct an engine without a name and want to keep reading the data already on the device, pass the old name: `new IndexDbSync(store, "nn-default")` and `new BroadcastSync(store, "nn-default")`.
- a91d14d: The package scope is now `@goodstate`. Replace `@nn/` with `@goodstate/` in your dependencies and imports. Nothing else in the API changed.

### Patch Changes

- Updated dependencies [a91d14d]
  - @goodstate/sync-engine@7.0.0
  - @goodstate/guards@0.5.0

## 5.0.0

### Major Changes

- a2f189c: The engine's constructor takes any `Replica` from `@nn/sync-engine/replica` instead of a `Store`, and the package no longer depends on `@nn/store` or `@nn/entities` at runtime. Passing a `Store` works as before. Subclasses read the synced object from `this.replica` instead of `this.store`.

### Patch Changes

- a2f189c: Report an entry from another context that can't be decoded to `onError` and stay connected. Before, the error was thrown from the channel's message handler, where nothing could catch it.
- Updated dependencies [a2f189c]
  - @nn/sync-engine@6.0.0

## 4.1.4

### Patch Changes

- Updated dependencies [79bcd03]
  - @nn/store@5.0.0
  - @nn/sync-engine@5.0.1

## 4.1.3

### Patch Changes

- Updated dependencies [9f2f4be]
  - @nn/sync-engine@5.0.0

## 4.1.2

### Patch Changes

- Updated dependencies [ac071bc]
- Updated dependencies [ac071bc]
- Updated dependencies [ac071bc]
  - @nn/store@4.0.0
  - @nn/entities@4.2.0
  - @nn/sync-engine@4.1.2

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
  - @nn/guards@0.4.0
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
  - @nn/guards@0.3.1
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
  - @nn/sync-engine@3.0.0
  - @nn/store@3.0.0

## 2.0.0

### Major Changes

- a36eeaf: `BroadcastSync` announces a newly attached store's state to the stores already on its channel. Every field is sent when the store attaches, so a store that was edited before it attached (for example a language set before `BroadcastSync.attach(store, name)`) reaches the other tabs on the channel, not only the changes made afterwards.

  `BroadcastSync.attach(store, name)` returns the engine right away instead of a promise and opens the channel in the background. Remove the `await` in front of the call:

  ```ts
  // before
  const sync = await BroadcastSync.attach(store, "settings");

  // after
  const sync = BroadcastSync.attach(store, "settings");
  ```

  The delegate follows `@nn/sync-engine`: rename `syncEngineDidFailToPush` to `syncEngineDidFail`, as described in the `@nn/sync-engine` release notes.

  Stop syncing with `sync.session.detach()` instead of `sync.detach()`.

### Patch Changes

- Updated dependencies [dbd5b8a]
- Updated dependencies [dbd5b8a]
- Updated dependencies [dbd5b8a]
- Updated dependencies [a36eeaf]
- Updated dependencies [a36eeaf]
- Updated dependencies [dbd5b8a]
  - @nn/guards@0.3.0
  - @nn/store@2.1.0
  - @nn/sync-engine@2.0.0

## 1.0.0

### Major Changes

- e983239: Adds `BroadcastSync`, a sync engine that keeps stores in different tabs, windows and workers of the same origin in sync over the [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API).

  Attach it with `BroadcastSync.attach(store, name)`. Every store attached under the same channel name receives each change the others make. A store that attaches later asks the others for their state and merges it. Call `sync.detach()` to stop sharing and close the channel.

  ```ts
  import { BroadcastSync } from "@nn/broadcast-sync";
  import { IndexDbRepository } from "@nn/indexdb-repository";
  import { RepositorySync } from "@nn/repository-sync";

  RepositorySync.attach(store, new IndexDbRepository("settings"));
  BroadcastSync.attach(store, "settings");
  ```

  `BroadcastSync` doesn't persist anything. Only the fields that changed since a store's engine attached are sent to a newcomer, and a store that's alone on the channel keeps its defaults. Attach `RepositorySync` next to it to keep the state across reloads.

  Each store needs its own channel name. `name` defaults to `"nn-default"`, so two different stores attached without a name would overwrite each other's fields that share a name.

### Patch Changes

- Updated dependencies [ffb3760]
  - @nn/entities@2.0.0
