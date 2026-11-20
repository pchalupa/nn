---
"@nn/broadcast-sync": major
"@nn/sse-sync": major
"@nn/indexdb-sync": major
---

The engine's constructor takes any `Replica` from `@nn/sync-engine/replica` instead of a `Store`, and the package no longer depends on `@nn/store` or `@nn/entities` at runtime. Passing a `Store` works as before. Subclasses read the synced object from `this.replica` instead of `this.store`.
