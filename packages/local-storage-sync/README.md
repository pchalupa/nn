# @goodstate/local-storage-sync

Sync engine that persists a store to [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and shares it between tabs.

## Installation

```sh
npm install @goodstate/local-storage-sync @goodstate/store
```

## Usage

The engine loads saved state into the store when it connects and saves every change after that. Other tabs on the same origin that use the same name merge each change through the [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).

```ts
import { LocalStorageSync } from "@goodstate/local-storage-sync";

const sync = new LocalStorageSync(store, "todos");

sync.onError((error) => console.error(error));
sync.connect();
```

The name defaults to `goodstate-default`. Each top-level property of the schema is saved as JSON under its own key, `<name>:<property>`. With the engine above, a `language` property is saved under `todos:language`.

`localStorage` holds about 5 MiB per origin, and every read and write blocks the main thread. Use this engine for small state, such as settings or drafts. For anything that grows, use [`@goodstate/indexdb-sync`](https://github.com/pchalupa/goodstate/tree/main/packages/indexdb-sync) with [`@goodstate/broadcast-sync`](https://github.com/pchalupa/goodstate/tree/main/packages/broadcast-sync) instead. A write over the quota is reported to `onError`, and the engine stays connected.

The engine keeps syncing when another tab removes its keys or clears `localStorage`. The store keeps its state and writes each property back on its next change. To erase saved state for good, call `dispose()` in every tab before clearing it.
