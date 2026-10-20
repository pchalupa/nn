# Atomic rows with stable snapshots

Status: approved in chat on 2026-10-14.

Amended on 2026-10-14: a row's register now holds its key inside the plain data as well as on the entity, so materialization no longer needs a separate keyed row projection. The public read shape and path rules below are unchanged.

Implementation plan: [Atomic rows with stable snapshots](../plans/2026-10-14-atomic-row-store.md).

## Goal

Simplify the early-stage store by making each collection row one last-write-wins value. Keep the simple, type-safe `@nn/react` path and recipe API and stable references for unchanged selections. The user accepts losing field-level conflict resolution within a row.

This supersedes the field-level entity requirement in the [previous simplification](2026-10-14-simplify-materialized-views-design.md). The previous work's preparation-before-mutation and sparse-array regression guarantees carry forward.

## Data model

Use `RGA<LWWRegister<RowData>>` for collections. A row's register holds plain data, including nested objects and arrays. Its entity key supplies collection identity and stays outside that data. Top-level scalar entries remain registers. RGA retains membership and ordering behavior.

Each row update replaces its register value once. Concurrent edits to different fields of the same row resolve by the register's existing timestamp winner rules; the losing row version's edits may be lost. Updates to distinct rows still target distinct registers. This design does not change the timestamp algorithm or claim to resolve its existing tie behavior.

Remove the store's dependence on nested `LWWMap` fields. Migrate hand-built store fixtures and callers to register-backed rows rather than keeping a compatibility adapter for map-backed rows.

## Public API

Keep the existing hook factory, variadic paths, readonly snapshots, and recipe callbacks:

```tsx
const [tickets, updateTickets] = useStore("tickets");
updateTickets((draft) => {
	draft.push({ title: "New", assignee: { name: "Ann" } });
});

const [ticket, updateTicket] = useStore("tickets", key);
updateTicket((draft) => {
	draft.title = "Changed";
});

const [name, updateName] = useStore("tickets", key, "assignee", "name");
updateName(() => "Bob");
```

Collection recipes keep their current membership and row-replacement behavior. Existing projected rows inside a collection draft stay readonly. New rows may omit a key. Additions append; reordering existing collection rows remains a no-op. Plain arrays within row data retain normal array ordering and mutation behavior.

Paths after a collection key address own plain-object properties inside the row. They can stop at a nested object or array, but arrays are terminal path targets: array indexes and methods are not path segments. Synthetic row identity is not an editable field path; a nested data property named `key` remains ordinary data.

Missing rows read as `undefined`; writing a missing row throws before invoking the recipe. Invalid root names, properties, and traversal through terminal values throw. Setters resolve their current row at invocation time. Recipes still run synchronously and use the mutated draft when they return `undefined`.

## Types

Retain the current root entry model for `State` and `Store`, but change `StateFromSchema` so a collection item maps directly to `LWWRegister<Infer<ItemSchema>>`. Delete recursive field-to-entity type construction.

Path types unwrap the collection row register once, then infer nested paths and values from plain row data. They do not recurse through entity kinds at each field. Preserve schema-derived readonly read values, mutable target recipes, and missing-row unions for reads only. Collection drafts continue accepting existing readonly rows and new rows with optional identity keys.

Keep root names, object field names, and recipe values statically checked through `@nn/react`. Runtime implementation values use `unknown` and narrowing, without casts or `any`.

## Snapshots and structural sharing

Use one recursive structural-sharing helper for plain data. Given the previous immutable snapshot and a new value, it returns the previous reference for equal values and constructs a frozen container only for changed objects or arrays. Reuse unchanged nested properties even when another property in the same row changes. Never freeze or mutate caller-owned inputs in place.

Compare array length, index presence, and indexed values explicitly. Holes differ from explicit `undefined`; sparse arrays must not skip deletions or return stale cached values. Object comparison uses own properties.

Keep revision-based caching at register and collection boundaries. A direct row read and a collection element use the same cached keyed row projection. A collection rebuild maps its row entities to those projections and reuses its prior array when the ordered row references match. This preserves surviving row identities through insertion and removal without a positional structural-sharing algorithm for collection membership.

Nested field reads select directly from the cached row snapshot. They need no separate path cache. Updating a sibling field must preserve the selected nested object reference, so `useSyncExternalStore` can skip its rerender. Old snapshots remain frozen and retain their original values after later updates.

The structural-sharing helper also supplies equality for no-op writes: unchanged prepared data returns the previous snapshot. Remove a separate structural-equality traversal if it has no remaining callers.

## Writes

For a row or nested field path, resolve the owning row and clone its plain data. Resolve the selected draft inside that clone, run the recipe, and install any returned replacement at that path. A row recipe may still see its identity key; remove that synthetic top-level key before preparing the register value. Ordinary nested keys stay intact.

Structurally share the resulting row data against its previous snapshot. If equal, perform no write and emit no notification. Otherwise replace the owning register once. A nested-field update has whole-row cloning and preparation cost; this is accepted.

For a collection recipe, retain one keyed membership scan. Prepare additions and replacements as complete row values, reject duplicate explicit keys, and collect removals. Validate and prepare all rows before mutating any existing entity. Apply the deferred operations within the existing store batch. No recursive field reconciliation or patch representation is needed.

Keep the existing row normalization and hydration rules for declared schema properties, including reserved top-level row keys and rejection of incompatible stored values. Perform normalization on plain data rather than constructing field entities. Preserve repository row keys and persisted plain-data shape so existing stored rows can hydrate into the new representation.

Preparation errors leave earlier planned edits unapplied. Exceptions during execution, including subscriber exceptions, still have no rollback guarantee. Store-wide subscriptions and batched notifications continue to deliver updates.

## Expected reduction

- Remove recursive field entity construction and entity-graph schema checks from `State.ts`.
- Replace nested entity path resolution with ordinary object traversal inside an owning register.
- Remove the map-recursion branch from reconciliation; row edits become one register replacement.
- Replace equality plus plain-data projection with structural sharing.
- Simplify path and schema types to describe row data rather than a nested CRDT graph.

Collection identity, schema validation, typed paths, and immutable snapshots still require code. Keep these responsibilities explicit; avoid adding a compatibility layer that recreates the removed entity model.

## Verification and release

Verify the same public hook examples and type inference, including nested object reads and recipes, invalid static paths, array terminals, and missing-row handling. Update store fixtures to use register-backed rows.

Test that a nested field write changes the owning register once, keeps the row key, and preserves sibling nested snapshot references. React tests must show that unchanged row and nested-object subscribers do not rerender, while changed selections do. Retain metadata-only, collection membership, old-snapshot immutability, and sparse-array regression tests.

Test whole-row merge semantics using distinct timestamps: edits to different fields in one row choose one complete row value, while edits to different rows remain independent. Verify collection recipes, row replacement, generated and explicit keys, no-op notifications, and failure-before-mutation behavior.

Verify hydration and persistence retain plain row shape and identity. Run the affected tests, workspace type checks, lint, formatting, spelling, and release-entry validation. Add consumer-visible Changesets documenting whole-row conflict behavior and migration of low-level map-backed store construction. Preserve unrelated work and leave commits to the user.
