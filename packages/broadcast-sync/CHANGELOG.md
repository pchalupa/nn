# @nn/broadcast-sync

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
