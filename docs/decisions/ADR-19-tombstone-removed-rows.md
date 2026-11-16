---
author: Petr Chalupa
date: 2026-11-12
---

# ADR-19: Tombstone removed rows

Partly supersedes [ADR-11](ADR-11-defer-the-ordering-crdt.md): its clause that `merge` does not remove rows no longer holds. Ordering stays deferred.

## Context

[ADR-11](ADR-11-defer-the-ordering-crdt.md) reduced [`RGA`](../../packages/entities/src/rga.ts) to a keyed list whose `merge` is a set union. It deferred tombstones and ordering until a sync layer actually merged, because nothing called `RGA.merge` outside tests.

That's no longer true. [`SyncEngine`](../../packages/sync-engine/src/sync-engine.ts) calls `Store.merge` when it pulls a root on connect and when it receives one from a peer, and that reaches `RGA.merge`. Engines send whole encoded roots, so every merge carries the full row list a peer holds. A row one tab removed comes back as soon as it merges with another tab, or with an IndexedDB record, that still has it.

The store already removes rows through `RGA.remove`, in [`ListStrategy.reconcile`](../../packages/store/src/reconciliation/list-strategy.ts). Earlier versions encode an `RGA` as `{ key, data: Encoded[], metadata: { kind: "RGA" } }`. Nothing runs in production yet, so there's no saved data or older peer that has to keep working.

## Decision

We will bring the full RGA from [ADR-03](ADR-03-use-rga-for-collection-row-order.md) back in phases, and phase 1 makes removals converge. Each `RGA` keeps a set of removed row keys that only grows. `remove` adds the row's key to it, and assigning `current` adds the key of every row the new list drops.

Deletion is permanent. A tombstoned key wins over everything: a concurrent edit of the row, a merge from a replica that still has it, and a later `push` under the same key. `merge` first unions the remote's tombstones into ours and detaches every local row they hit, then adds the remote's live rows it doesn't already have, skipping tombstoned keys. It notifies once when membership changed or the tombstone set grew, because new tombstones change what persistence has to write.

Tombstones encode as `metadata.tombstones: string[]`, and `data` keeps its shape. Decoding requires the field and rejects a list without it, or with anything other than an array of strings, with `Invalid encoded RGA.`

We don't add timestamps, insertion anchors, or a clock in this phase. Permanent deletion doesn't need them, and ordering is a later phase.

## Alternatives considered

**Encode tombstones in `data` as `{ rows, tombstones }`.** Tombstones are state, so they could sit next to the rows. We rejected it because our entities already split the encoding this way: `data` holds the value, and `metadata` holds the bookkeeping that makes a merge converge, like [`LWWRegister`](../../packages/entities/src/lww-register.ts)'s `timestamp`. Tombstones are that kind of bookkeeping, and keeping `data` an array of rows leaves the row decoding unchanged.

**Keep removed rows in the sequence as hidden elements.** This is the structure ADR-03's RGA needs, because a removed element stays in place as an anchor for insertions that name it. We rejected it for now because phase 1 has no anchors to serve, so it would pay for that structure early. The ordering phase changes the encoding for anchors anyway, so we'll restructure then.

**Decode lists without `tombstones` as having none.** That would keep lists saved by earlier versions loading. We rejected it because nothing is in production, so there's no saved data to protect, and a required field keeps the format strict.

**Let a newer re-insertion bring a removed key back.** ADR-03 hid a key until an insertion stamped after the removal arrived. That needs a stamp on every insertion and every removal. We rejected it because the store always mints a fresh key for a new row, so reusing a removed key isn't something a user does. Permanent deletion keeps phase 1 free of timestamps.

## Consequences

Removals now converge. Merging in any order, or merging the same replica twice, gives the same live rows, and a reload from IndexedDB keeps removed rows removed. `@nn/store`, `@nn/sync-engine` and `@nn/react` don't change.

We accept unbounded growth, as ADR-03 did. Every removed key stays in the set and in every encoded root. That costs one UUID string per removed row, and we haven't defined when it would be safe to drop one.

This is a breaking change for `@nn/entities`, so it ships as a major release. A removed key can't come back: code that removes a row and pushes it again under the same key, or drops a key by assigning `current` and adds it later, sees the row ignored. `encode()` now always includes `metadata.tombstones`, so code that compares encoded lists exactly sees a new shape. Lists encoded by earlier versions no longer decode, so every replica has to run the new version, and a payload from an older one fails with an error that `SyncEngine` reports. The store always creates rows under fresh keys, so `@nn/store` and the sync packages only pick up the new dependency range.

Row order still doesn't converge across replicas, as ADR-11 describes. The ordering phase will turn this tombstone set into tombstoned sequence elements, and that work will also decide how anchors are encoded.
