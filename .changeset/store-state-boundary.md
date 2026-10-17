---
"@nn/store": patch
---

Persist changed records and delete removed collection rows from the repository. Loading stored data no longer writes it back, and equal external revisions still notify subscribers without rewriting unchanged records.

Log persistence failures without blocking later writes. Failed operations are not retried automatically.

Persistence runs independently for each update, without ordering guarantees between updates.
