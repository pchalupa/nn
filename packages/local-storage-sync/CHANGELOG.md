# @goodstate/local-storage-sync

## 7.0.3

### Patch Changes

- f4d5b67: Shares its version number with the other `@goodstate/*` packages, so it jumps from 1.0.0 to the same version as `@goodstate/store`. Releases are now built and published by GitHub Actions with a provenance attestation, so npm shows which commit and workflow a version came from. Nothing in the API changed.
- @goodstate/observable@7.0.3
  - @goodstate/sync-engine@7.0.3

## 1.0.0

### Major Changes

- 9a6c108: Adds `LocalStorageSync`, a sync engine that persists a store to [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and shares it between tabs through the [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).

  ```ts
  import { LocalStorageSync } from "@goodstate/local-storage-sync";

  const sync = new LocalStorageSync(store, "todos");

  sync.onError((error) => console.error(error));
  sync.connect();
  ```

  Each top-level property is saved as JSON under `<name>:<property>`, and `name` defaults to `goodstate-default`. On connect the engine loads every saved property and writes every property, then writes each one that changes. A write over the quota is reported to `onError` and the engine stays connected. Another tab removing a key or clearing `localStorage` doesn't stop the engine. It writes the property back on its next change.

  Use it for small state. For state that grows, use `@goodstate/indexdb-sync` with `@goodstate/broadcast-sync`.
