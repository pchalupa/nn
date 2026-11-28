---
author: Petr Chalupa
date: 2026-11-28
---

# ADR-20: Ship localStorage persistence as one sync engine

## Context

[ADR-14](ADR-14-ship-indexeddb-persistence-as-one-sync-engine.md) settled that a new storage backend is a new engine package built on [`SyncEngine`](../../packages/sync-engine/src/sync-engine.ts), with the engine and its storage code shipped together. The [`@goodstate/sync-engine` README](../../packages/sync-engine/README.md) already uses a `localStorage` engine as its teaching example, but no package ships one.

[`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) covers two jobs that need two engines today. It persists across reloads, like [`IndexDbSync`](../../packages/indexdb-sync/src/index-db-sync.ts). Each write also fires a [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) in every other same-origin document, which is what [`BroadcastSync`](../../packages/broadcast-sync/src/broadcast-sync.ts) does over a channel. The event names the key that changed and carries its new value. Writing a value equal to the stored one fires no event.

It also has limits. It stores strings only, it holds about 5 MiB per origin in current browsers (as of 2026-11), and every call blocks the main thread. `SyncEngine` pushes one encoded top-level property at a time, and each entry is the whole property with its tombstones ([ADR-19](ADR-19-tombstone-removed-rows.md)).

Whatever key layout we pick becomes the saved format. Users' data sits under those keys, so changing the layout later needs a migration.

## Decision

We will ship `@goodstate/local-storage-sync`, which exports only [`LocalStorageSync`](../../packages/local-storage-sync/src/local-storage-sync.ts). An app creates it with `new LocalStorageSync(store, name)`, where `name` defaults to `"goodstate-default"` like the other engines.

We will store each top-level property of the schema under its own key, `<name>:<property>`, as `JSON.stringify` of its encoded entry. `pull` reads one key and `push` writes one key, so a change rewrites only the property that changed. The key layout, the JSON encoding and the event filtering live in an internal [`LocalStorage`](../../packages/local-storage-sync/src/local-storage.ts) class, as the IndexedDB code lives in `IndexDb`. The package doesn't export it.

The same engine listens to the `storage` event. It merges a write to one of its keys through `receive`, and ignores `sessionStorage`, other prefixes, removed keys and `clear()`. When another tab removes a key, a tab that's still open keeps its state and writes the property back on its next change. A value that doesn't parse or merge is reported to `onError`, and the engine stays connected.

## Alternatives considered

**Store the whole snapshot under one key.** One `getItem` restores everything, and the layout has a single key to version. We rejected it because every change would rewrite every property, which is the main-thread cost this storage can least afford. The `storage` event would also wake other tabs to merge properties that didn't change.

**Persist only, and leave cross-tab sync to `BroadcastSync`.** Each engine would do one job, as `IndexDbSync` does. We rejected it because the browser already delivers the `storage` event for the writes we make. An app would install and connect two engines, and post every change twice, to get what one engine gets for free.

**Disconnect when another tab removes one of the keys.** This matches `IndexDbSync`, which drops its connection when another connection deletes its database. We rejected it because a single key can disappear for reasons that aren't a decision to stop syncing, such as code that clears unrelated storage. Dropping the engine would leave that tab's edits unsaved until it reloads.

## Consequences

An app with small state, such as settings or drafts, gets persistence and cross-tab sync from one package. An app whose state grows should stay on `IndexDbSync` with `BroadcastSync`. The package README says so, because nothing stops a user from filling the quota. A write over the quota is reported and dropped like any failed push.

Keys are `<name>:<property>`, so renaming a schema property strands its saved value under the old key, as it already does for an IndexedDB object store. A name that itself contains `:` still works, because the engine passes only schema properties on to the replica.

An app that erases saved state, for example on sign-out, has to `dispose()` the engine in every open tab before it clears `localStorage`. Otherwise a tab that's still open writes its state back on its next change.

A corrupt stored value fails the connection attempt and leaves the engine `disconnected`, the same as a corrupt IndexedDB entry. If that turns out too strict, we change both engines together.

The engine runs only where `localStorage` exists. In a worker, an opaque origin or a browser with storage disabled, the first `pull` throws, the error goes to `onError`, and the engine ends `disconnected`. The tests run in [jsdom](https://github.com/jsdom/jsdom), which provides `localStorage` and `StorageEvent`, and simulate another tab by dispatching the event by hand.
