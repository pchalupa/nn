# @nn/broadcast-sync

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
