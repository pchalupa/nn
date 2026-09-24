---
"@nn/repository": major
"@nn/indexdb-repository": minor
---

Adds `get` to the `Repository` interface, so a single record can be read by its id.

`getAll` only fits a type that holds many records. Reading one record meant fetching the whole store and picking the first item, which is wasteful and says the wrong thing about the data.

```ts
await repository.get<Settings>("settings", "settings"); // Settings | undefined
```

The method resolves to `undefined` when the id is not stored. Every `Repository` implementation has to add it.
