# Path-scoped store reads and updates

Status: approved on 2026-10-02.

Implementation plan: [Path-scoped store implementation](../plans/2026-10-02-path-scoped-store.md).

Implementation update, 2026-10-14: [Simplify materialized views and writes](2026-10-14-simplify-materialized-views-design.md) supersedes the internal diff/patch pipeline and array projection bookkeeping described below. [Atomic rows with stable snapshots](2026-10-14-atomic-row-store-design.md) then replaced nested field entities with one plain-data register per row, so conflicts within a row resolve as one whole value. The path API, nested field paths, and revision-cached snapshots remain in place.

## Goal

Simplify the store implementation while keeping assignment-based updates inside setter callbacks. React consumers must receive immutable, reference-stable values. Small reads and writes must stay scoped to their target, and unchanged collection rows must retain their references.

The previous selector-based API made the same function responsible for reading data and identifying a write target. Arbitrary selectors can filter, combine, or reconstruct data, so writing their results back requires origin tracking and target-inference rules. A path identifies the target directly.

Whole-store drafts and whole-store snapshot rebuilding were considered and rejected: both do unnecessary work for small changes, and rebuilding every row loses useful reference identity. Transaction proxies would preserve assignment syntax but introduce another layer of mutation tracking. Explicit paths let us keep the existing scoped clone/diff approach.

## Public React API

Keep the existing store creation and hook factory. The returned hook accepts a nonempty sequence of path segments instead of a selector:

```ts
const [tickets, setTickets] = useStore("tickets");

setTickets((draft) => {
	draft.push({ title: "New ticket" });
});

const [ticket, setTicket] = useStore("tickets", key);

setTicket((draft) => {
	draft.done = true;
});

const [done, setDone] = useStore("tickets", key, "done");

setDone(() => true);

const [language, setLanguage] = useStore("language");

setLanguage(() => "cs");
```

The callback receives a writable draft of the addressed value. It can mutate the draft or return a replacement, matching the existing recipe convention. An `undefined` return uses the mutated draft. Recipes run synchronously against the current target at invocation time, rather than against the value from the last render.

Collection recipes can insert and remove rows. Row recipes edit that row; field recipes edit that field. Collection row keys remain identity metadata rather than writable row fields. New rows can omit their keys and use the existing identity-generation mechanism.

Derived values are ordinary component computations:

```ts
const [tickets, setTickets] = useStore("tickets");
const openTickets = tickets.filter((ticket) => !ticket.done);
```

There is no writable scope for a filtered or reconstructed result. Memoization of derived component values is separate from the store's snapshot identity.

## Path resolution and types

Resolve segments using the entity structure:

1. The first segment names an entry in `State.entries`.
2. At a `Collection`, the next segment is an opaque row key resolved with `Collection.find`, never an array index.
3. At an `LWWMap`, the next segment names an entity-backed field.
4. A register is a terminal target. Objects and arrays stored inside a register are edited through that register's draft, rather than exposing additional entity paths.

A path can stop at any entity, including a nested map. Zero segments do not identify a scope. Generated UUIDs and existing legacy keys follow the same lookup rules; there is no key-format validation or key-order assumption.

Use one resolver shared by reads and writes. Its result distinguishes a resolved entity from a missing collection row and retains the collection context needed for keyed row projection and schema-backed row creation. Resolve against the current entity graph on each operation so replacement or removal cannot leave a setter pointing at a detached entity.

Types infer valid next segments, the readonly read value, and the recipe draft from the path. Static root and field names are checked; row keys are strings whose existence is checked at runtime. Implement runtime narrowing without casts or `any`.

**Existing type mismatch to resolve:** `State.ts` models every schema row field as an `LWWRegister`, while `State.entityFromSchema()` creates an `LWWMap` for nested objects. This was adequate for the projected value shape but cannot describe entity-backed paths accurately. The proposed implementation aligns schema-to-entity inference with the existing runtime representation. It does not change the schema format or storage representation. This correction is part of the design review.

## Missing targets and errors

A missing row, or a field path below a missing row, reads as `undefined`. A mounted hook observes the row appearing, disappearing, or being replaced under the same key.

A write to a missing row throws before invoking the recipe. It never creates a row implicitly. Creation uses a collection setter. If a row was removed between render and an event handler, the setter resolves the path again and reports the missing target.

The read type includes `undefined` when a path traverses a collection lookup. The recipe type describes the resolved target: a row callback receives a row draft, not a missing-row union. A register whose own value may be `undefined` still includes that possibility in its draft type. Runtime resolution distinguishes a missing row from a present register holding `undefined`.

An unknown root, unknown map field, or attempt to continue through a terminal register is an invalid path and throws when that segment is reached. Resolution stops at the first missing row; subsequent segments are checked statically for typed callers but cannot be validated against an absent runtime entity. Existing patch-shape and row-key validation remains separate from path resolution.

Recipe and diff failures happen before entity mutation. Applying a multi-operation patch retains the existing notification-batching behavior; this design does not add rollback for application-time failures.

## Reads and React snapshots

A read resolves the path and materializes only its target. Keep the existing entity-revision projection cache and collection structural sharing. Reading a row by key must not materialize its containing collection. Reuse the keyed-row projection cache directly so the row read and its containing collection can share the same keyed object.

Repeated reads of an unchanged target return the same object reference. A change to one row produces a new collection projection and a new changed-row projection while retaining references for unchanged rows. Unrelated root properties are not materialized by the read.

Use these cached projections directly as `useSyncExternalStore` snapshots. Since the hook no longer executes arbitrary selectors, it does not need a caller-owned selection cache or structural comparison of derived results. Primitive snapshots use their values; a missing row uses `undefined`.

Keep the existing store-level subscription initially. An update can cause several hooks to recheck their paths, but an unchanged snapshot does not require a consumer rerender. This also catches row insertion, deletion, and replacement without maintaining another subscription graph.

Hook callbacks must use the current render's path, retain stable identity for equal path segments, and update when a segment changes. Retained setters from older renders keep their original path and resolve its current entity when invoked. Changing path length must respect React's hook dependency rules.

## Scoped updates

The update pipeline is:

```text
path → current entity → cached projection → cloned draft
     → recipe → diff → apply to that entity
```

Clone and diff only the selected scope. Field updates touch the field's value, row updates touch the row, and collection updates touch the collection. Whole-collection recipes still have collection-sized cloning and diffing costs; small row edits use a row path.

Superseded in part by [ADR-04](../../decisions/ADR-04-hand-collection-recipes-the-rows-themselves.md), recorded the same day: a collection recipe receives the projected rows themselves rather than a deep copy, so it changes membership and replaces rows but cannot edit one in place.

An unchanged draft produces no entity writes or store notification. Apply a nonempty patch under the existing batching mechanism. Continue translating changed fields into entity operations so persistence and merge behavior remain field-aware.

The target entity determines the update boundary: edits inside a register-held object or array replace that register's value, while maps and collections apply changes through their child entities. This applies recursively to register fields inside a row.

Resolve collection row factories from the addressed collection context, rather than searching for the source of a projected value. Existing schema-backed and manually constructed stores retain their current row-creation behavior.

## Package boundaries and removal

`@nn/store` owns typed paths, resolution, scoped reads, and scoped updates. Proposed method shapes are `store.read(...path)` and `store.update(path, recipe)`, where the update path is a typed tuple. `@nn/react` exposes the variadic `useStore(...path)` and binds the setter to that path.

`View.ts` keeps materialization, projection caches, row keys, and structural sharing. `Draft.ts`, `diff.ts`, and `applyPatch.ts` keep their scoped responsibilities. Entity observation and persistence remain the source of store update notifications.

After migrating consumers, remove the selector-based `Store.select` and `Store.update` signatures, `Selector`, `SelectCache`, origin tracking, `targetFor`, `resolveKey`, and selector-specific write-target errors. Remove `lazyView.ts`, including its live root proxy and `settle`, because reads now address entities directly. Remove `isStructurallyEqual.ts` if it has no remaining callers after migration.

The intended reduction comes from replacing arbitrary selection/write-back behavior with entity addressing. Performance-sensitive projection caches remain because they provide the agreed identity guarantees.

## Migration and verification

This changes the public `@nn/store` and `@nn/react` APIs. Update examples and package consumers, and add Changesets describing path-scoped reads and writes. Update affected current documentation alongside the implementation. The materialized-view research note describes an older `SnapshotManager` architecture; its current-code mapping needs an explicitly identified historical or updated treatment rather than being used as implementation guidance.

Verify through public behavior:

- Collection, row, nested-map, and field paths infer the right readonly values and writable recipes. Invalid paths fail type checks. Missing-row read types remain distinct from present-target recipe types.
- A row read returns a keyed object without materializing unrelated rows or roots. Repeated reads and unchanged rows preserve reference identity.
- Row insertion, removal, replacement, and missing-row writes follow the documented lifecycle, including a setter invoked after deletion and hooks whose path changes.
- Row and field updates affect only their addressed scope. No-op recipes produce no notifications; successful multi-operation collection updates produce one store notification.
- Schema-backed insertion and persistence round trips preserve field entities and row identity.
- React consumers observe updates without snapshot loops, retain stable setters for equal paths, and avoid rerendering unchanged row subscribers. Exercise the draft API through the configured React Compiler checks.
- Existing narrow-update, broad-update, unrelated-read, and multi-subscriber benchmarks are adapted to paths and compared on the same runtime. Confirm that row operations avoid collection-wide cloning and materialization; collection projection may still scan its rows to rebuild an array.

Use the repository's existing type, lint, formatting, and test checks. Remove obsolete selector-inference tests as their behavior is retired, while keeping coverage for projection identity, diffing, and persistence.
