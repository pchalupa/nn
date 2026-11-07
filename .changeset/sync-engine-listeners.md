---
"@nn/sync-engine": major
"@nn/sse-sync": major
"@nn/indexdb-sync": major
"@nn/broadcast-sync": major
---

Sync engines expose their connection lifecycle and failures directly, through `onStateChange` and `onError`, instead of `session` and `delegate`.

- `sync.session.retry()` and `sync.session.detach()` become `sync.retry()` and `sync.detach()`. `sync.session.state`, `connected`, `disconnected` and the other state flags become `sync.state`, `sync.connected` and so on.
- `sync.session.changes.subscribe(listener)` becomes `sync.onStateChange(listener)`.
- `sync.delegate = { syncEngineDidFail: (engine, error) => … }` becomes `sync.onError((error) => …)`. Any number of listeners can subscribe, at any time. With none, failures are dropped.
- `SessionState` is exported as `SyncState`, and `SyncEngineDelegate` is removed.

Custom engines that extend `SyncEngine` still drive `this.session`, which is now protected. They report failures with `this.errors.notify(error)` instead of `this.delegate?.syncEngineDidFail(this, error)`.
