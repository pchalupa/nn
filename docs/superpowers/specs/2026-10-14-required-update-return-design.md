# Required update return values

## Goal

Give store updates one consistent contract: the callback returns the next value for the addressed path. The motivation is API simplicity across collections, rows, row fields, and registers.

## API

```ts
export type Recipe<Value> = (draft: Value) => Value;
```

The callback receives the existing draft representation. It can mutate that draft and return it, or return a replacement value.

```tsx
updateTickets((draft) => {
	draft.push(newTicket);
	return draft;
});

updateTickets((tickets) => tickets.filter((ticket) => ticket.id !== id));

updateLanguage(() => "en");
```

This contract applies to `State.write`, `Store.update`, and the updater returned by the React hook. The return requirement belongs to the callback. The update methods themselves return `void`.

## Return semantics

- The returned value is authoritative. If the callback mutates its draft and then returns a different value, only the returned value is used.
- Returning a value equal to the existing state produces no writes or subscriber notifications and preserves the cached view identity.
- `undefined` is an ordinary value, not a signal to use the draft. Callbacks can return it where the addressed value type includes `undefined`.
- TypeScript rejects a callback with no return, or with a branch that does not return, when the target type excludes `undefined`. When the target type includes `undefined`, such as string registers, TypeScript 5.1+ accepts a missing return, and that branch writes `undefined`.
- At runtime, an omitted return and an explicit `return undefined` are indistinguishable. Both produce `undefined`; there is no implicit-draft fallback.
- A thrown callback error applies none of that callback's draft changes.

## Data flow

Each collection row is one `LWWRegister` holding plain row data. `State.write` resolves the target to a collection, a row register, or a top-level register, plus the field segments inside a row. It clones the target view into a draft and passes the value at those field segments to the callback.

Remove both `undefined` fallbacks in `State.write`:

- **No field segments** (collection, row, top-level register): the callback result is the next value for the target.
- **Field segments inside a row**: the callback result is always written into the cloned row draft at the addressed field, including `undefined`. The updated row draft is then the next row value.

Collection results go through `reconcile`, which matches rows by key, keeps existing row registers, and writes only rows whose prepared data changed. Row results go through the collection's row preparer and `share`, which keeps unchanged nested references. This change does not add collection reordering.

Draft construction follows the existing implementation. A collection draft is a writable array containing existing readonly rows or newly supplied draft rows. Row and register drafts are cloned. Requiring a return does not make existing collection rows deeply writable.

## Validation and failure behavior

TypeScript checks the result against the addressed draft type, including through the React hook. Keep `NoInfer` on store write APIs so callback results cannot widen the inferred path type.

All runtime checks finish before any write, so a rejected result does not partly update state or notify subscribers:

- A non-array collection result, including `undefined`, throws `WriteTargetError`.
- A non-object row result, including `undefined`, throws `WriteTargetError` from row preparation.
- Duplicate row keys throw `RowKeyError`.
- Schema-backed rows are normalized and validated by their row preparer, so wrong field types throw `TypeError`. An `undefined` field result is accepted and normalized like missing data.

Top-level registers keep their existing boundary: writes are not validated against the schema, so JavaScript callers can write any value, including `undefined`. Field results in hand-built rows without a preparer are not validated either. Full runtime schema validation would need a separate design.

## Migration

Update mutation-style callbacks in current source, examples, and tests to return their draft. Update early returns to return the intended next value. Replacement-style callbacks already satisfy the contract.

The example in `apps/example-react/src/components/Column/index.tsx` adds `return draft` after `draft.push(...)`.

Publish a Changeset covering the breaking callback contract in `@nn/store` and `@nn/react`, with a mutation-plus-return migration example.

## Verification

- Type checks reject mutation-only callbacks, wrong result types, and conditional missing returns for targets that exclude `undefined`.
- Type checks accept mutation-plus-return, replacement values, and explicit `undefined` for a target whose type includes it.
- Runtime tests verify that a returned replacement wins over mutations to the draft.
- Runtime tests verify that returning `undefined` clears a top-level register and a row field instead of keeping the previous value.
- `undefined` results for collections and rows fail before any state change or notification.
- Existing tests continue to cover row identity, no-op snapshot identity, batched notifications, and preparation failures after their callbacks are migrated.
- A React test covers the required-return updater through the hook.

## Decision

Require returns while keeping writable drafts. Keeping optional returns keeps two conventions. Requiring immutable inputs would also change how callers construct values, which is unnecessary for the stated goal.
