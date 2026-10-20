---
"@nn/store": patch
---

Move path reading and the update pipeline onto `State` as `read(path)`, `write(path, value)` and `update(path, recipe)`. `Store.read` and `Store.update` keep their signatures and now delegate, with `Store` retaining subscriptions and repository wiring. `State` batches entity change notifications.

`State.resolve` and its `Target` and `TargetKind` types are no longer public, and `Draft` and `CollectionDraft` are no longer re-exported from the package root. Use `read` and `write` to reach a path, and `Update`'s recipe parameter to name a drafted value.
