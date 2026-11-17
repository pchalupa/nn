# List reconciliation: cheap array mutations and value matching for primitives

Date: 2026-11-17
Size: small change (short design)

## Intent

Two improvements to how `@nn/store` writes a draft list back into its `RGA`, taken from the reconciliation research (recommendations 2 and 3; the note itself was lost before it was committed).

1. **Cheap mutating array methods.** `draft.tickets.splice(0, 1)` on a 1,000-item list currently builds a tracker for every item, because the native method reads each element through the proxy. Locally the "removes an item from a list of 1,000 items" benchmark costs ~314 µs, about 80× a single field update and close to creating the whole list.
2. **Match primitive items by value when order allows it.** `ListStrategy` matches non-object items by index, so removing `"b"` from `["a", "b", "c"]` rewrites register `b→c` and deletes the last register. A concurrent peer edit of `"c"` then lands on the wrong item. Matching by value removes only `"b"`'s register.

## Goals

- `splice`, `shift`, `unshift`, `pop` and `reverse` on a draft list only create trackers for the elements they return.
- Primitive lists keep each surviving value's register when the new list is the old values in their old order, with some removed and new ones appended at the end.
- Every existing test keeps passing unchanged.

## Non-goals

- **Reordering.** Reorders stay ignored until the ordering CRDT returns to `RGA` (ADR-11). `store.test.ts` "ignores a reorder" and `list-strategy.test.ts` "keeps item order on a reorder-only draft" stay as they are. No `RGA.current = ordered` assignments.
- Positional insert into `RGA`.
- Schema-declared item keys, per-field strategy overrides, scoping `inspect` (other research items).

## Anti-goals

- A draft must never hand out a raw `Entity`, including the values returned by `splice`/`shift`/`pop` and items read after a raw mutation shifted indexes.
- Value matching must never change the visible order of a primitive list compared to today.

## Constraints

- Repo rules: no type casts, no `any`, `if` over ternaries, kebab-case files, no comments.
- `RGA` can only `push` and `remove`; order of live items is insertion order.
- A Changeset (`@nn/store`, patch) for the observable effects: faster array methods, and fewer register rewrites on primitive lists.

## Approaches

**Change 1 (array methods): one sensible way.** Intercept the mutating methods in `ListTracker.get` and run them on the raw target array (the same approach TanStack DB takes). Leaving the methods on the proxy cannot work, because a native method reads every element through the `get` trap. `sort` and `copyWithin`/`fill` stay on the proxy: a `sort` comparator would be handed raw entities, and the other two are rare.

**Change 3 (primitive matching): three options considered, A picked.**

- **A. Value matching only when order is preserved, positional otherwise (picked).** Covers `filter`, removing from the middle and `push`, keeps today's behaviour for everything else, and needs no ordering support.
- **B. Defer to the ordering CRDT.** Rejected: the order-preserving cases are the common ones and do not need ordering.
- **C. Full value matching (LCS) plus `current = ordered`.** Rejected: it is local-only reordering, ruled out above. `unshift("green")` on `["red"]` would otherwise commit `["red", "green"]` (see `store.test.ts:643`).

## Design

### Change 1: raw mutating methods on `ListTracker`

- `ListTracker.get` returns a wrapper for `splice`, `shift`, `unshift`, `pop` and `reverse`. The wrapper marks the list written (same path as the `set` trap), applies the native method to the raw `target`, and resolves each returned placeholder entity into its draft before returning it. `push` already only touches `length` and new indexes, so it can stay on the proxy (builder's call).
- **`pending` must stop being index-based.** Today it recognises an unread item as `this.items?.[Number(key)] === value`. After a raw `splice` the placeholders shift, so that check fails and `Draft.resolve` / later reads would return a raw entity. Replace it with an identity check against the set of entities this tracker seeded as placeholders, which is independent of index.
- `ListStrategy.reconcile` already accepts raw entity placeholders in a written target (`find` treats `Entity.is(item)` as identity) and `context.resolve` covers new items, so it needs no change for this.

### Change 3: value matching for primitive items in `ListStrategy.match`

Applies when no target item is an object (object items keep identity matching). With `old` the current register values and `next` the target:

1. Trim the common prefix and common suffix with `Object.is`.
2. If the remaining `next` is a subsequence of the remaining `old` (greedy two-pointer), match those registers and let the unmatched old ones be removed.
3. Otherwise, if there is no common suffix, accept `next` = (subsequence of the remaining `old`) followed by new values, and append the new values, but only when the remaining `old` is empty or at least one of its values was matched, and no appended value equals a removed old value. The first condition keeps an in-place overwrite (`["x"]→["z"]`) a register rewrite; the second stops a reorder (`["a","b"]→["b","a"]`) from turning into remove plus push.
4. Otherwise fall back to today's positional matching for the whole list. The fallback is whole-list, not just the middle, because positional matching in a trimmed middle could append values in the wrong place.

Examples: `["a","b","c"]→["a","c"]` removes `b`'s register only; `["a","b"]→["a","b","c"]` pushes `c`; `["a","b","c"]→["a","c","d"]` removes `b` and pushes `d`; `["x","y"]→["z","y"]` and `["x"]→["z"]` rewrite `x→z` (positional); `["a","b"]→["b","a"]` and `["red"]→["green","red"]` stay positional, as today.

## Verification

- New `draft.test.ts` cases: `splice`/`shift`/`pop` return drafts, not entities; reading any index after a raw `splice` returns a draft; only returned elements get trackers.
- New `list-strategy.test.ts` cases for each example above, asserting register identity (`toBe`) for survivors.
- Existing `store.test.ts`, `draft.test.ts`, `list-strategy.test.ts` pass unchanged.
- `pnpm bench --reporter=verbose` before and after; expect "removes an item from a list of 1,000 items" to drop well below the current ~314 µs local mean.

## Left to the builder

- Exact shape of the method wrapper and whether `push` is intercepted.
- Whether value matching lives in `list-strategy.ts` or a new `sequence-diff.ts`.
- Behaviour for a list mixing object and primitive items (schema does not produce one today); keep current behaviour.
