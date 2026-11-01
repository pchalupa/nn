---
"@nn/store": patch
---

`State.merge` publishes a single change notification per merge, even when several fields of the entry change. Register values are stored and read as assigned, without being cloned.
