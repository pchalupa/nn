---
"@nn/store": major
---

`state.subscribe` moves to `store.subscribe`, and listeners are called with no arguments instead of the set of changed entry names. `Store` now always owns `state.delegate`, so persistence of the changed entries starts before any listener runs.

```ts
store.state.subscribe((changed) => {}); // before
store.subscribe(() => {}); // after
```
