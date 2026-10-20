# Simplify materialized views and writes

Status: approved in chat on 2026-10-14.

Superseded in part by [atomic rows with stable snapshots](2026-10-14-atomic-row-store-design.md). Rows now use one plain-data register instead of field entities. Nested paths and recipe syntax remain available; conflicts within a row resolve as one whole value. Structural sharing replaces the separate equality traversal.

Implementation plan: [Simplify materialized views and writes](../plans/2026-10-14-simplify-materialized-views.md).

## Goal

Reduce the materialization and write machinery while keeping the existing type-safe `@nn/react` API. Stable snapshots must let `useSyncExternalStore` skip store-driven rerenders when the selected value has not changed. Extra scanning, allocation, and structural comparisons are acceptable.

## Public behavior

Keep `useStore(...path)` and its readonly value / recipe updater pair. Keep collection recipes for membership changes and row replacement, row recipes for editing fields, and nested entity-backed field paths. Existing collection rows stay frozen inside collection recipes; editing a row in place still uses its row path.

Keep schema inference, missing-row reads as `undefined`, errors for missing write targets, and current path validation. Keep the existing `LWWMap` and `LWWRegister` structure so concurrent edits retain field-level merge behavior. Keep store-wide subscriptions and notification batching.

Collection additions append and collection recipes do not reorder existing rows, matching the current implementation. Register-held arrays remain ordinary values whose order matters. Keys remain row identity metadata; ordinary entity-backed fields named `key` retain their existing behavior.

## Materialization

Keep the entity projection cache with only the entity revision and immutable projected value. Keep the keyed-row cache so reading a row directly shares its object with the containing collection.

On an unchanged entity revision, return its cached projection immediately. Otherwise build a candidate by recursively materializing its contents. RGA contents use `materializeRow`; ordinary arrays use `materialize`. Compare the candidate with the previous projection using `isStructurallyEqual`, retain the previous reference when equal, and update the cached revision.

Remove `Elements`, `projectElements`, per-element revision arrays, source-array tracking, and alignment branches. Unchanged child entities supply their own cached projections. Freeze newly created objects and arrays as today.

Required reference guarantees:

- Repeated reads of the same unchanged entity return the same reference.
- Metadata-only revisions and structurally equal register writes retain visible snapshot references.
- Changing one collection row preserves the references of the other row entities.
- Collection insertion or removal preserves surviving row references.
- Direct row reads share the keyed projection used by collection reads.
- Previously returned snapshots stay immutable after later writes.

For a changed register-held array, unchanged plain-object elements may be recreated. Entity-backed child and row caches still preserve their references. There is no new identity guarantee for independently materialized plain objects.

## Reconciliation

Replace `diff`, the `Patch` union, and `applyPatch` with one internal `reconcile` operation. Its inputs are the resolved entity, previous view, recipe result, and collection row factory.

The operation recursively visits the target and collects a flat list of deferred write functions. It executes the list only after traversal and preparation succeed. This keeps validation errors from applying an earlier field update, insertion, or removal.

Traversal rules:

1. Identical values need no action.
2. Registers compare structurally and queue replacement only when their values differ.
3. Maps validate record shapes, walk the union of previous and next field names, and recurse through existing field entities. Missing writable fields are errors; omitted register fields are cleared as today.
4. Collections validate array shapes and keyed previous rows, find previous rows by key, and scan the recipe result once. Reject duplicate explicit keys. Reconcile existing rows, prepare new rows through the existing factory, and queue removals for previous keys absent from the result.

Use one keyed collection algorithm. Remove the positional fast path and unused insertion indexes. Prepare new row entities before executing queued writes so a factory failure cannot follow a partially applied update. No-op recipes execute no writes and emit no notifications.

Keep the existing errors for duplicate keys and incompatible write targets. Application-time failures, including exceptions from subscribers, still have no rollback guarantee. Batching continues to belong to `Store.update`.

## Files

- Simplify `packages/store/src/View.ts` and retain its public types.
- Add `packages/store/src/reconcile.ts`, including the internal row-factory type.
- Update `packages/store/src/State.ts` to call reconciliation after running the recipe.
- Remove `packages/store/src/diff.ts`, `Patch.ts`, and `applyPatch.ts` after migrating their callers.
- Replace patch-description tests in `diff.test.ts` with reconciliation behavior tests.
- Extend existing view, store, and React tests only where needed to cover the guarantees above.

The React hook and recursive path types retain their current API. Update current documentation that describes the removed internal pipeline. Add a Changeset if implementation introduces a consumer-visible fix, including validation of row creation before applying writes.

## Verification

Run the affected store and React tests, including existing path typing checks. Cover nested field writes, register-held objects and arrays, additions and removals, explicit and generated row keys, ignored collection reorder, no-op notification behavior, and a late validation or row-factory failure leaving earlier queued changes unapplied.

Use reference assertions and React render counts to verify metadata-only updates, unchanged row subscriptions, and direct-row / collection snapshot sharing. Check snapshot immutability after updates.

Run the repository TypeScript, lint, and formatting checks appropriate to changed files. Keep runtime values of unknown shape typed as `unknown`, narrow them without casts, and add no code comments. Record any existing failures separately from regressions caused by this change.
