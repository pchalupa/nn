---
"@nn/store": major
"@nn/react": major
---

Makes `Store.update` and the updater returned by `useStore` accept only recipes. A primitive recipe receives the current value and returns the next value. Object and array recipes mutate their draft and return nothing.

```ts
// Before
setLanguage("cs");
update((draft) => {
	draft.push(ticket);
	return draft;
});

// After
setLanguage(() => "cs");
update((draft) => {
	draft.push(ticket);
});
```

Object and array recipes edit a mutable copy. The store validates the final snapshot and reconciles it into its entities. Returning a value from these recipes is ignored, so forgetting `return draft` no longer writes `undefined`.

`Store.update` delegates recipes to `State.update`. Plain values are no longer accepted. A primitive recipe can derive its next value from its argument, and returning the current value leaves the store unchanged.

Clear a register with `setLanguage(() => undefined)` instead of `setLanguage(undefined)`.

`Recipe` and `PathDraft` are no longer exported from `@nn/store`, and `Draft` and `RowDraft` are gone. The recipe's draft is the plain mutable shape of the path's value, where a row's `key` is optional so a new row can be pushed without one. Reading `key` off a row draft now needs a narrow.

`Update` is newly exported from `@nn/store`.

Duplicate row keys in the final collection throw `StoreError.duplicateKey`. Duplicating a row by spreading its draft carries `key` along. Remove the original row first, or push without a `key` and let the store mint one. A replacement with the same key updates the existing entity. `RGA.merge` still merges a remote row into the local row that shares its key.

A final snapshot naming a field the row schema does not declare is rejected instead of being dropped, whether the field came from an assignment, a replacement row, or a pushed record. A row's own `key` stays permitted on a row-level write and keeps naming the row it came from.

Replacing a collection with a value — `update(["tickets"], [])` — is rejected by the types. Push rows to add them and set `length` to `0` to remove them.

`useStore` returns `[view, Update<Data, Segments>]`. The hook forwards to `Store.update` and adds no rule of its own.
