---
"@nn/broadcast-sync": patch
"@nn/entities": patch
"@nn/indexdb-sync": patch
"@nn/react": patch
"@nn/sse-sync": patch
"@nn/store": patch
"@nn/sync-engine": patch
"@nn/time": patch
---

Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
