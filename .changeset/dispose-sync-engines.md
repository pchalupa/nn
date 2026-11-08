---
"@nn/sync-engine": major
"@nn/sse-sync": major
"@nn/indexdb-sync": major
"@nn/broadcast-sync": major
---

Sync engines stop with `dispose()` instead of `detach()`, since nothing attaches them anymore.

- `sync.detach()` becomes `sync.dispose()`, and `sync.detached` becomes `sync.disposed`.
- `SyncState.Detached` becomes `SyncState.Disposed`, and its value changes from `"detached"` to `"disposed"`.

Custom engines that extend `SyncEngine` call `this.session.reopen()` instead of `this.session.reconnect()` to close and open a connected transport again. It still does nothing unless the engine is connected.
