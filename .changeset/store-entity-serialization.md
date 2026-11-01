---
"@nn/store": major
---

Replaces `State.encode(name)` with `State.entity(name)`, which returns the live CRDT entity for the field. Store persistence now passes that entity to its codec for serialization.

Replace `store.state.encode(name)` with `store.state.entity(name).encode()` when you need an encoded snapshot. `entity(name)` returns the live entity rather than a snapshot; continue using `state.update` and `state.merge` to change state.
