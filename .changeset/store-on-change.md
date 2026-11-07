---
"@nn/store": major
"@nn/react": major
---

`Store` now has a single listener method, `onChange`, and no longer exposes its `State` or any `Entity`.

- Read and write on the store directly: `store.state.read()` becomes `store.read()`, and `store.state.update(fn)` becomes `store.update(fn)`.
- Listen with `store.onChange(listener)`, which returns its unsubscribe function. It replaces `store.updates.subscribe` and `store.changes.subscribe`. The listener receives the changed top-level fields, keyed by name and encoded the first time it reads them, and can ignore them.
- `store.merge(name, value)` takes encoded data, the shape `store.encode().data[name]` returns, and throws when it can't be decoded.

`createStore` from `@nn/react` returns this `Store`, and `useRead` and `useUpdate` are unchanged.
