---
"@nn/store": patch
---

Move path reading and the update pipeline onto `State` as `read(path)` and `write(path, recipe)`. `Store.read` and `Store.update` keep their signatures and now delegate, with `Store` retaining only batching, subscriptions and repository wiring.

`State.resolve` and its `Target` and `TargetKind` types are no longer public, and `Draft` and `CollectionDraft` are no longer re-exported from the package root. Use `read` and `write` to reach a path, and `PathDraft` to name a drafted value.
