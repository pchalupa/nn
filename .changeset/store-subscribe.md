---
"@nn/store": major
---

`Store` now owns change subscriptions. `store.state.subscribe` is replaced by `store.subscribe(listener)`, whose listener receives no arguments. `Store` persists the changed entries before calling listeners.

```ts
store.state.subscribe((changed) => {}); // before
store.subscribe(() => {}); // after
```
