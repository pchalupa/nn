---
"@nn/sync-engine": minor
---

Add public `connect()` so engines can be configured and observed before starting synchronization. It starts an idle engine without exposing its session. Retry and detachment behavior stays unchanged.
