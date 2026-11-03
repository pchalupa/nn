---
"@nn/sync-engine": major
---

Adds the abstract `SyncEngine` class that every sync engine extends.

An engine implements only its transport: `open()`, `close()`, `pull(name)` and `push(name, entry)`. It starts by calling the protected `attach()`, for example from a static factory as `RepositorySync.attach()` does. `SyncEngine` then pushes every change the store reports and runs the bootstrap in the background. The bootstrap calls `open()`, then pulls each schema field and merges the stored value into the store. If `open()` or any `pull()` throws, the engine detaches itself.

`push()` can run before `open()` finishes, because changes are pushed right away. Restored values are pushed back too, since merging them counts as a change. A failed `push()` doesn't detach the engine. It calls `syncEngineDidFailToPush(syncEngine, error)` on the engine's `delegate` instead. Without a delegate, the failure is ignored.

`detach()` stops pushing and calls `close()` once. It can run before `open()` has finished or after it failed, so `close()` must handle both. `close()` isn't called again when `open()` finishes after `detach()`.

A push-based engine passes incoming records to `receive(entries)`. `entries` must hold a record for every schema field.

Install this package only to write your own sync engine; the engines depend on it already.
