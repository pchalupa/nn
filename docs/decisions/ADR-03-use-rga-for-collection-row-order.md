---
author: Petr Chalupa
date: 2026-10-02
---

# ADR-03: Use RGA for collection row order

Superseded by [ADR-11](ADR-11-defer-the-ordering-crdt.md): the ordering algorithm and tombstone retention are deferred until the sync layer needs them. The in-memory-only persistence clause is superseded by [ADR-06](ADR-06-persist-entity-owned-root-records.md).

Implementation update, 2026-10-14: references below to `diff`, `Patch.ts`, and `applyPatch` describe the earlier store pipeline. [Reconciliation](../../packages/store/src/State.ts) now prepares and applies writes directly. Collection recipes still append additions and ignore reordering of existing rows; the unused insertion indexes were removed. See the [simplification design](../superpowers/specs/2026-10-14-simplify-materialized-views-design.md).

## Context

This library is local-first. Replicas edit independently, including while offline, and merge later.
Each entity type says how it converges: [`LWWRegister`](../../packages/entities/src/LWWRegister.ts)
picks the value with the greater [`Time`](../../packages/time/src/Time.ts), and
[`LWWMap`](../../packages/entities/src/LWWMap.ts) merges each field on its own.

The ordered row set had no such rule. It kept its rows in a `Map` and handed them out in local
insertion order, and its merge appended remote-only rows in whatever order the remote iterated.
Membership and field values converged; order did not. Two replicas that each added a row and then
merged ended up showing different arrays, and nothing in the type said which one was right.

Row keys cannot supply the order. [ADR-02](ADR-02-use-uuid-v4-for-generated-identities.md) picks
UUID v4 and states that keys do not sort in creation order, so time ordering comes from `Time`
instead. `Time` is a hybrid logical clock, but it has no step that advances the local clock past a
stamp received from another replica, and it carries no replica identity, so two replicas can mint
the same stamp.

The store layer already waits on this. [`Patch.ts`](../../packages/store/src/Patch.ts) computes an
index for every added row and then drops it, because `applyPatch` can only append, and it carries a
comment saying a `move` operation is absent for want of an ordering CRDT.
[The array-like CRDT research note](../notes/research/array-like-crdts.md) surveys the options and
recommends implementing [RGA](https://arxiv.org/html/1707.01747v3#S6) first.

## Decision

We will order collection rows with a Replicated Growable Array, and rename the type from
`Collection` to [`RGA`](../../packages/entities/src/RGA.ts) so the name says which rule it follows.
The type keeps the smallest surface the store actually writes against: `push`, `remove`, `find`,
`merge`, `subscribe`, and the `current` getter and setter it inherits from `Entity`. We dropped
`length` and `replace` and the key `push` used to return, because each one restated something the
caller already had: `current.length`, assigning `current`, and the row's own `key`.

Each row occupies one element. An element's id is the row's key paired with a `Time` stamp, and an
element records which element it was inserted after. To place an element we start just after the
element it names and skip every element with a greater id, so competing insertions after the same
anchor land in descending id order. Both replicas apply the same rule, so they reach the same
sequence whichever order the merges arrive in. The key breaks a tie between equal stamps, because
`Time` has no replica of its own.

A removed element keeps its place in the sequence as an anchor, so an insertion that named it still
lands where it was meant to. These tombstones are never collected.

RGA needs ids that do not contradict causality, which `Time.now()` alone does not guarantee. The
`RGA` instance keeps the greatest stamp it has minted or seen and mints the next one above it. We
keep that clock inside the entity rather than adding a receive step to `@nn/time`, so the fix stays
where the requirement is.

On top of the sequence, a key is live at most once, because `find`, path resolution in
[`State`](../../packages/store/src/State.ts) and the duplicate check in
[`diff`](../../packages/store/src/diff.ts) all treat a collection as a keyed set. The greatest
insertion of a key wins and the loser is tombstoned, and the surviving row keeps the local object's
identity while taking the other side's contents. A removal hides the key until an insertion stamped
after the removal brings it back, which is what makes removing a row and adding it again converge in
both directions.

Ordering lives in memory only. We persist rows as keyed records and rebuild the sequence from the
order the repository returns them in.

## Alternatives considered

**Fugue or FugueMax.** [Fugue](https://arxiv.org/html/2305.00583v3) orders elements by an arbitrary
unique id under a deterministic total order, which suits UUID v4 keys better than RGA's causality
requirement, and FugueMax proves a non-interleaving property RGA does not have. We rejected it for
now because the research note recommends understanding RGA first, and because the interleaving RGA
allows shows up when a replica repeatedly inserts before its own previous insertion. Our write path
only appends. If we add positional insert, this is the first thing to revisit.

**Logoot or LSEQ.** These encode the position in the identifier itself and avoid keeping deleted
anchors. We rejected them because identifier length grows with the edit pattern, which we would then
have to measure and manage, and we would gain nothing for an append-only write path.

**Adopt Yjs, Automerge or Loro.** Each is a mature library with a list type, and Loro's
`MovableList` even resolves concurrent moves. We rejected them because they bring their own document
model, identity scheme and storage format, and this library is the entity layer those models would
replace. We would be adopting a second CRDT system next to our own.

**Leave order non-convergent.** The cheapest option, and it is what we had. We rejected it because a
local-first library whose list order depends on merge order is not something we can build the store
and the sync layer on.

## Consequences

Concurrent additions now converge. A merge is commutative and idempotent: merging two replicas in
either order gives the same sequence, and merging the same replica twice changes nothing. The
regression tests in [`RGA.test.ts`](../../packages/entities/src/RGA.test.ts) check those properties
directly.

The rename is a breaking change for `@nn/entities`. The `./Collection` subpath export is gone and
consumers import `@nn/entities/RGA` instead. We ship no alias, because the export map points
straight at source and a stale import then fails at compile time rather than quietly working.

We accept unbounded growth. Every removed row leaves an element behind, and the id of every element
ever seen stays in an index, so a long-lived sequence that is edited heavily keeps memory it will
never hand back. Garbage collection needs its own argument about which anchors live descendants and
delayed operations still depend on, and we have not made it.

We accept a cost per operation. Each add builds an element, an id string and two index entries on top
of the row itself. Measured against the previous implementation on 2026-10-02, the store benchmarks
moved within a few percent at 100 rows, and the heaviest 10 000-row case, which rewrites the whole
collection row by row, cost 10 to 15% more across repeated runs. That case runs few enough iterations
that single runs swing much wider, so treat it as a range rather than a figure. Reads of an unchanged
collection are unaffected.

Order still does not survive a reload, because we persist rows and not the sequence. On IndexedDB a
reloaded collection comes back in primary-key order, which is the order it had before this change
too. Closing that gap means storing each row's anchor and stamp and keeping tombstones, which
changes the [`Repository`](../../packages/repository/src/Repository.ts) contract. That is a separate
decision.

The store gains the ordering layer its write path was missing. `applyPatch` can now honour the index
that `diff` already computes, and a `move` operation becomes possible. Neither is implemented here,
and the comment in `Patch.ts` now says `move` is absent by choice rather than for want of a CRDT.
