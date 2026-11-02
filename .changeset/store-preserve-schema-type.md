---
"@nn/store": major
"@nn/react": major
---

Derive store data types from the schema instead of accepting a separate data type parameter. `Store`, `State`, and the React `use` hook retain the concrete schema type throughout inference.

Replace explicit `Store<Data>` annotations with `Store<typeof schema>`. `State` no longer accepts a second data type parameter. Replace explicit `use<Data>(store)` calls with `use<typeof schema>(store)`, or omit the type argument and let it infer from the store.
