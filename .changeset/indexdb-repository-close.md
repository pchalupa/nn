---
"@nn/indexdb-repository": minor
---

Adds `close()`, which closes the IndexedDB connection that `init()` opened.

Writes already started still finish, as IndexedDB waits for pending transactions before closing. After `close()`, `get()` and `set()` throw `RepositoryNotInitializedError` until `init()` runs again, and stored entries are kept.
