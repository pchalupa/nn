---
"@nn/store": major
---

`state.subscribe` listeners no longer receive the set of changed entry names; they are called with no arguments. `State` reports to `Store` first, so persistence of the changed entries starts before any listener runs.

```ts
store.state.subscribe((changed) => {}); // before
store.state.subscribe(() => {}); // after
```
