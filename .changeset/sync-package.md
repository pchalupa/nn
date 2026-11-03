---
"@nn/sync": major
---

Adds the abstract `Sync` class that every sync engine extends.

`Sync` keeps an engine safe without the engine author having to get it right. It holds edits until the first restore has merged, so they never overwrite stored data. It also never writes a field that failed to restore, and it stops cleanly on `detach()`. An engine implements only its transport: `open()`, `pull(name)`, `push(name, entry)` and, if it needs one, `close()`. A push-based engine passes incoming records to `receive(entries)`.

Every engine reports to `sync.delegate`: `syncDidRestore(sync)` when the initial restore finishes, and `syncDidFail(sync, error)` for each failure, whether it happens while opening, restoring, writing or receiving. Without a delegate, failures are logged with `console.error`.

Install this package only to write your own sync engine; the engines depend on it already.
