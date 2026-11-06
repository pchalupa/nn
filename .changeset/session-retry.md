---
"@nn/sync-engine": minor
---

A disconnected engine can try again: `session.retry()` starts a new connection attempt from `disconnected` and does nothing in any other state. The attempt opens, pulls and pushes every field as the first connection does.

`session.changes` notifies observers with the new state after each transition, once its effects have run, so an engine can react when it disconnects or connects. It doesn't deliver the current state on subscribe; read `session.state` for that. Observers must not throw. `SessionState` is now exported from `@nn/sync-engine`.
