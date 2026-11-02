---
"@nn/store": patch
---

Protect schema-shaped snapshots returned by `state.read()` from external mutation so cached reads stay consistent with stored state. Make edits through `state.update()`, which still provides a mutable draft.
