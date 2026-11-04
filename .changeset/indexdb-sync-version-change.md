---
"@nn/indexdb-sync": patch
---

When another tab upgrades the IndexedDB database, for example after a deploy adds a field to the schema, the engine reopens the database, pulls the stored state and pushes every field, instead of failing on every later write. When another tab deletes the database, the engine stops syncing and doesn't create the database again. Closing the database explicitly reports neither.

Reopening no longer fails with `VersionError` while the other tab's upgrade is still running.
