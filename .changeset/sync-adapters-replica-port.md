---
"@nn/broadcast-sync": minor
"@nn/sse-sync": minor
"@nn/indexdb-sync": minor
---

The engine's constructor takes any `Replica` from `@nn/sync-engine/replica` instead of a `Store`, and the package no longer depends on `@nn/store` or `@nn/entities` at runtime. Passing a `Store` works as before.
