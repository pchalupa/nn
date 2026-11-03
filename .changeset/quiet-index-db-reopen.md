---
"@nn/indexdb-repository": patch
---

`IndexDbRepository.init()` no longer closes and reopens the database when every store in the schema already exists. When a store is missing, it reopens once at the next version after the one on disk, so the database version goes up by one per upgrade.
