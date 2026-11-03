---
"@nn/sync-engine": major
---

Adds the abstract `SyncEngine` class that every sync engine extends.

`SyncEngine` keeps an engine safe without the engine author having to get it right. It holds edits until the first restore has merged, so they never overwrite stored data. It also never writes a field that failed to restore, and it stops cleanly on `detach()`. An engine implements only its transport: `open(signal)`, which resolves to a function that closes what it opened, `pull(name, signal)` and `push(name, entry)`. The signal aborts when the engine detaches, so a transport can cancel a pending request. The close function runs on `detach()` only if `open()` succeeded, including when it finishes after `detach()`. `Close` is exported for engine authors. A push-based engine passes incoming records to `receive(entries)`.

Every engine reports to `sync.delegate`: `syncEngineDidRestore(sync)` when the initial restore finishes, and `syncEngineDidFail(sync, error)` for each failure, whether it happens while opening, restoring, writing or receiving.

Install this package only to write your own sync engine; the engines depend on it already.
