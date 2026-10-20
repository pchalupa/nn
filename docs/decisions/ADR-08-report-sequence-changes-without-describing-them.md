---
author: Petr Chalupa
date: 2026-10-04
---

# ADR-08: Report sequence changes without describing them

[ADR-10](ADR-10-defer-store-integration-until-view-materialization.md) subsequently defers Store persistence and projection filtering. This record's common sequence signal and notification rules remain in effect; the Store integration described below is historical.

Implementation update, 2026-10-14: [ADR-11](ADR-11-defer-the-ordering-crdt.md) defers the ordering CRDT, so `RGA` no longer has `mergeState`, tombstones, or a clock. The single-notification decision and the `Entity.subscribe` payload stand for the keyed list.

## Context

[ADR-07](ADR-07-separate-state-signals-from-projection-updates.md) moved every entity to one state-change subscription and kept the membership descriptions [RGA](../../packages/entities/src/RGA.ts) already emitted, adding `kind: "state"` for changes that add, remove, update and replace do not cover. To carry those descriptions, RGA keeps a second listener set beside the one `Entity` owns, dispatches to both from `emitChange` with its own error aggregation, and tracks in `mergeState` which keys a merge revealed, which it hid, whether tombstones moved, and whether the sequence reordered, so it can pick a kind per emit.

Nothing reads the descriptions. [Store](../../packages/store/src/Store.ts) subscribes to roots and uses `EntityChange.source` to find the entity to compare. Persistence marks the root dirty and ignores the payload. `@nn/react` and `@nn/index-db-repository` never subscribe to a sequence directly. A search across `packages/` and `apps/` finds `RGAChange` and `change.kind` only inside RGA's own tests.

The descriptions also decide how often a merge notifies. A merge emits once per added row, once per removed key, and once more for a reorder or a metadata-only change. Those emits happen outside a [`Batch`](../../packages/store/src/Batch.ts) run, so Store cannot coalesce them and a subscriber runs once per affected row for a single merge.

## Decision

We will remove the change descriptions from RGA. A sequence reports its changes through `Entity.subscribe` like every other entity, and the payload is `EntityChange`: the originating entity in `source`, nothing else. This supersedes ADR-07's clause that sequence changes retain their membership descriptions and add `kind: "state"`. Every other part of ADR-07 stays in effect, including the single state-change subscription, origin propagation through maps and sequences, dispatch that calls all listeners and then rethrows the first failure, and Store-side filtering by projection identity.

A merge emits once. `mergeState` still tracks revealed keys so it can tell a row it both revealed and hid from one it only hid, and still restores the previous snapshot array when no row moved, because the [view layer](../../packages/store/src/State.ts) compares that array by reference. It then emits a single change when the sequence reordered, membership changed, tombstones moved, or the clock or element count advanced. `emitChange` and the second listener set are gone, so error aggregation lives only in `Entity.emit`.

A consumer that needs to know what changed reads `current` and compares it, which is what Store already does through its projections.

## Alternatives considered

**Keep the descriptions for a consumer that may arrive later.** They cost a second listener set, a second dispatch path with its own error handling, and per-kind bookkeeping in the hardest method in the package. We rejected paying that for a consumer we cannot name. The sequence state is still there, so we can derive a description again if something asks for one.

**Keep one emit per affected row and drop only the payload.** This keeps the notification counts subscribers see today. We rejected it because a merge is one transition and the per-row emits are not batched, so a subscriber runs N times for one merge while reading the same settled sequence every time.

**Derive the descriptions in Store instead.** Store has the previous and current projections, so it could report what moved. We rejected it because no consumer asked for that either, and it would move the same unused work to another package.

## Consequences

`RGAChange` is gone from the public surface. `RGA.subscribe` is `Entity.subscribe`, and the payload is `{ source }`. Exhaustive switches on change kinds no longer compile. Because the type never shipped, the change is a correction to the pending `@nn/entities` release notes rather than a break for anyone on a published version.

A merge notifies once however many rows it added, removed or moved. A subscriber that counted notifications per row sees fewer calls. Rows still report their own field merges as they happen, so a merge that changes two rows and reorders the sequence calls a listener three times: once per row, once for the sequence.

A metadata-only merge still emits, so persistence still writes the root. Store still filters by projection identity, so consumers still see nothing for it. The storage format, the ordering rules and the merge results are unchanged.

RGA drops about 55 lines, including the branch in `mergeState` that chose between four kinds. The remaining emit condition is one boolean, which is easier to check against the merge rules in [ADR-03](ADR-03-use-rga-for-collection-row-order.md).
