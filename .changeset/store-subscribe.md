---
"@nn/store": major
---

Replaces `store.events` with `store.subscribe`. Listeners are called with no arguments after each state change, and `subscribe` returns the function that removes the listener.

```ts
store.events.on("update", () => {}); // before
store.subscribe(() => {}); // after
```

`Store` always owns `state.delegate`, so persisting the changed fields starts before any listener runs.
