---
"@nn/sync-engine": major
---

Adds the abstract `SyncEngine` class that every sync engine extends.

`SyncEngine` keeps an engine safe without the engine author having to get it right. It holds edits until the bootstrap has merged the stored data, so they never overwrite stored data. It also never writes a field that failed to restore, and it stops cleanly on `detach()`. An engine implements only its transport: `open()`, `close()`, `pull(name)` and `push(name, entry)`. `detach()` always calls `close()`, and calls it again if `open()` finishes afterwards, so `close()` must be safe before `open()` has finished, after it failed, and more than once. A push-based engine passes incoming records to `receive(entries)`.

Install this package only to write your own sync engine; the engines depend on it already.
