---
"@nn/store": major
"@nn/react": major
---

Replaces snapshot selectors with `store.state`, a schema-shaped root you read as plain data and update through a draft.

```ts
store.state.read().language; // "cs"

store.state.update((draft) => {
	draft.language = "en";
	draft.tickets.push({ id, title, status });
});
```

`read()` returns the whole state typed as `InferStateType<typeof schema>`. `update(recipe)` hands the recipe a mutable copy of the root and reconciles it into the store's entities when the recipe returns. `Store.getSnapshotOf`, `Store.events` and the React `Selector` type are removed.

Every field starts at a default: strings `""`, numbers `0`, booleans `false`, arrays `[]`, and objects with each of their fields defaulted.

Row identity is internal; rows have no public `key`. Declare your own identifier for lookups and React list keys. Editing a row of the draft keeps its identity, and pushing a new object creates a new row. A new row always lands at the end of its list, wherever it was inserted in the draft, and reordering existing rows has no effect.
