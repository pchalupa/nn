---
"@nn/store": major
---

Read a store with `store.query(selector)` and write it with `store.mutate(recipe)`. `query` runs the selector once against the current state and returns its result, so you can read just the part you need.

`store.read()` and `store.update()` are removed. Replace `read()` with `query`, passing a selector or `(state) => state` for the whole state, and rename `update` to `mutate`. The recipe works as before.

```ts
// Before
store.update((draft) => {
	draft.language = "cs";
});
store.read().language;

// After
store.mutate((draft) => {
	draft.language = "cs";
});
store.query((state) => state.language);
```
