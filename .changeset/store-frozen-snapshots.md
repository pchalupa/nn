---
"@nn/store": patch
---

Freezes the data `state.read()` returns, so outside code cannot mutate it. Make edits through `state.update()`, which still hands you a mutable draft.

Snapshots are cached per entity. An update rebuilds only the objects and arrays along the changed branch; unrelated rows and objects keep their references between reads. Writing a value equal to the current one changes nothing and does not notify.
