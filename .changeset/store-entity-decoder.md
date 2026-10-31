---
"@nn/store": major
---

`Store` now owns persistence. It restores from and persists to the repository through an internal decoder that looks up the built-in entity kinds by `metadata.kind`, instead of through the schema. `State` takes only the schema: `capture` is replaced by `encode(name)`, which returns the field's `Encoded` value, and `merge(name, entity)` merges a decoded entity into a field. The `CapturedEntry`, `RegisterEntry`, `MapEntry` and `CollectionEntry` types are removed.

Restored fields that change on merge are written back to the repository once at startup. Persisted entries are no longer validated against the schema: values that are not encoded entities and entries stored under another key are still ignored, but malformed entries or entries of a different entity kind are no longer reset to defaults and may throw.
