---
"@nn/store": major
---

Take the path as a single array in `Store.read(path)`, matching `Store.update(path, recipe)`. Spread segments into an array at the call site:

```ts
store.read(["tickets", "1", "status"]);
```

`use()` from `@nn/react` is unchanged and still takes variadic segments.
