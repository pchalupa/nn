---
"@nn/react": major
---

Rename `useRead` to `useQuery` and `useUpdate` to `useMutation`, matching the store's new `query` and `mutate`. `createStore` now returns `{ store, useQuery, useMutation }`.

Both hooks take and return the same things as before, and components re-render exactly as often. Rename the hooks where you destructure and call them:

```tsx
// Before
const { store, useRead, useUpdate } = createStore(schema);
const language = useRead((data) => data.language);
const update = useUpdate();

// After
const { store, useQuery, useMutation } = createStore(schema);
const language = useQuery((data) => data.language);
const mutate = useMutation();
```
