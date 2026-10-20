---
"@nn/store": major
"@nn/indexdb-repository": major
---

Persists collection rows as a tree of field entities instead of one register per row, so `capture` and `restore` now mirror the `LWWMap` row shape. The stored format changed and there is no migration: a stored entry that does not match the current shape resets that root to its schema default instead of restoring or throwing, and `IndexDbRepository` wipes its object stores on the version upgrade that carries this change. Existing local data is discarded on first load after upgrading.
