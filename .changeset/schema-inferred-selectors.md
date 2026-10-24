---
"@nn/store": major
"@nn/react": major
---

Replace typed paths with schema-shaped root snapshots, readonly selectors, and draft updates.

This is a breaking API change. Read state with `store.state.read()` and update it with `store.state.update((draft) => { draft.language = "cs"; })`. Replace path reads with ordinary property access or array searches. The public data type is `InferType<typeof schema>`; the path class and path-derived data types are removed.

In React, bind `const useStore = use(store)`. The hook returns a `useState`-shaped pair: `const [tickets, update] = useStore((data) => data.tickets)`. The updater always drafts the store root, whatever the selector returns. Components that only write call the hook without a selector, `const [, update] = useStore()`, and never subscribe. Update collections through `draft.tickets.push(ticket)` and primitives through assignments. Selector results reuse structurally equal arrays and plain objects, so unrelated selected-data changes do not force re-renders.

State now initializes strings to `""`, numbers to `0`, booleans to `false`, arrays to `[]`, and object fields recursively. Restoration also defaults missing fields while preserving valid stored values and timestamps. Draft insertions require complete schema-shaped values, and invalid updates apply no partial changes.

Generated row identity is internal instead of a public `key`. Declare an application identifier for row lookups and React list keys. Editing a draft row preserves identity; inserting a fresh object creates new identity. Object collections still support removal and appending, but reject reordering and inserting new rows ahead of surviving rows.
