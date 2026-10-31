---
"@nn/store": minor
---

Keep projected references stable when an entity's derived value is structurally unchanged, including equal-value writes and metadata-only CRDT changes.

Store subscribers still receive batched state-change notifications. Projection-based notification filtering is deferred until view materialization is complete.
