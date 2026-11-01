---
"@nn/store": major
---

`Store` now owns persistence. It restores from and persists to the repository through an internal codec that looks up the built-in entity kinds by `metadata.kind`, instead of through the schema. `State` takes only the schema: `capture` is replaced by `entity(name)`, which returns the field's CRDT entity, and `merge(name, entity)` merges a decoded entity into a field. The `CapturedEntry`, `RegisterEntry`, `MapEntry` and `CollectionEntry` types are removed.

Persisted entries are no longer validated against the schema. Decoded entities with mismatched keys are ignored when merging into state, but malformed entries or entries of a different entity kind are no longer reset to defaults and may throw.
