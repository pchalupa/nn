---
"@nn/sync-engine": major
---

Adds the abstract `SyncEngine` class that every sync engine extends.

`SyncEngine` keeps an engine safe without the engine author having to get it right. It holds edits until the first restore has merged, so they never overwrite stored data. It also never writes a field that failed to restore, and it stops cleanly on `detach()`. An engine implements only its transport: `open()`, `pull(name)`, `push(name, entry)` and, if it needs one, `close()`. A push-based engine passes incoming records to `receive(entries)`.

Every engine reports to `sync.delegate`: `syncEngineDidRestore(sync)` when the initial restore finishes, and `syncEngineDidFail(sync, error)` for each failure, whether it happens while opening, restoring, writing or receiving.

Install this package only to write your own sync engine; the engines depend on it already.
