---
"@nn/store": major
---

`new Store()` now takes a `State` instance instead of a plain record of entities. `State` is exported from `@nn/store`:

```ts
// Before
const store = new Store({ tickets, language });

// After
const store = new Store(new State({ tickets, language }));
```

`Store.fromSchema` is unchanged.
