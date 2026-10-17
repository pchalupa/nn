---
author: Petr Chalupa
date: 2026-10-14
---

# ADR-11: Defer the ordering CRDT

Supersedes the ordering decision in [ADR-03](ADR-03-use-rga-for-collection-row-order.md).

## Context

This branch built [`RGA`](../../packages/entities/src/RGA.ts) in full: element ids pairing each row key with a `Time` stamp, insertion anchors, tombstones, and a clock that mints stamps above everything the instance has seen. That is what makes collection order converge across replicas, and [ADR-03](ADR-03-use-rga-for-collection-row-order.md) records why we wanted it.

Nothing that ships with the store exercises it. `Store` accepts a `Remote` but never wires it up, the repository path only persists rows, and `RGA.merge` is called from tests alone. The store writes against `push`, `remove`, `find`, `current`, and `subscribe`. The merge machinery was about two thirds of the class, it accepts unbounded tombstone growth, and its change bookkeeping in `mergeState` — tracking revealed keys, hidden keys, tombstone moves and reorders to pick an emit rule — was the hardest code in `@nn/entities` to check. The sync layer that needs convergence does not exist yet, so the costs are paid now and the benefit arrives with work that has no shape today.

## Decision

We will defer the ordering CRDT until the sync layer needs it. `RGA` becomes a keyed ordered list: one `Map` from row key to row, iterated in insertion order, with `push`, `remove`, `find`, the `current` getter and setter, and one subscription per live row. We keep the name and the `@nn/entities/RGA` export path, because the export map already ships them and the type's surface is unchanged; the name is a promise we make good on when the ordering CRDT returns.

`merge` stays, because `Entity` requires it and row values still converge by their own rules. It becomes a set union: a shared key merges through the row's own `merge`, and an unseen key appends its row. It does not remove rows, because without tombstones a replica cannot tell a key its peer removed from a key its peer never had. A key is live at most once: constructing, pushing, or assigning `current` with a second row under a live key merges it into the live row instead of leaving two rows with one key.

## Alternatives considered

**Keep the full RGA until sync lands.** The machinery is cohesive and tested, so keeping it costs mainly the tombstone growth and the review weight of `mergeState`. We rejected it because no shipped path merges, so we would carry the hardest code in the package for a consumer we cannot name. The class is self-contained, benched, and tested, so reintroducing it is close to a revert, and it comes back against real sync requirements instead of guessed ones.

**Adopt Yjs, Automerge, or Loro for the list.** [ADR-03](ADR-03-use-rga-for-collection-row-order.md) already rejected adopting a second CRDT system beside our own entity layer, and deferring changes nothing about that.

**Make `merge` throw until sync lands.** We rejected it because rows already know how to merge their values, the union merge is what `LWWRegister` rows give us for free, and throwing would leave the abstract `Entity` contract unusable for sequences.

## Consequences

`@nn/entities` loses about 200 lines in `RGA` and most of the convergence tests. Merges converge for additions and for row values, but not for removals: a row that one replica removed comes back the next time a replica that still holds it merges. Order across replicas does not converge either; within one replica, rows keep the order they were added in, and a removed-and-re-added row moves to the end.

The store is unchanged. `Store`, `State`, and the React hook never merge, and `push`, `remove`, `find`, `current`, and `subscribe` keep their signatures, so `@nn/store` and `@nn/react` consumers see no difference.

When sync lands, we reintroduce the ordering CRDT as [ADR-03](ADR-03-use-rga-for-collection-row-order.md) describes, and that record still holds the reasons Fugue, Logoot and the CRDT libraries lost. That work will have to decide what the `Repository` contract stores for anchors and tombstones, which this deferral leaves untouched. [ADR-08](ADR-08-report-sequence-changes-without-describing-them.md) keeps its single-notification rule for the keyed list; its `mergeState` references describe the deferred implementation.
