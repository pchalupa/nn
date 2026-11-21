---
"@nn/store": patch
---

`Store.merge` no longer throws when an entry comes from a replica whose schema changed a value between an object, an array and a single value. Such a value keeps its local value, array items that changed this way are skipped, and the other fields of the entry still merge. Fields the local schema doesn't declare are now dropped from merged entries instead of being stored.
