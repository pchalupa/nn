---
author: Petr Chalupa
date: 2026-10-04
---

# ADR-09: Stamp times with a replica identity

## Context

[`Time`](../../packages/time/src/Time.ts) implements a Hybrid Logical Clock as a pair of physical milliseconds and a logical counter. Ordering two of those pairs is a partial order: when two replicas stamp the same instant and the same counter, neither is after the other.

A shared process-wide counter hides this locally. Two entities created in the same millisecond in one process receive counters `0` and `1`, so they never tie. The tie is only reachable across devices, where two replicas independently mint the first write of a millisecond and both get counter `0`.

[`LWWRegister.merge`](../../packages/entities/src/LWWRegister.ts) resolves a conflict by asking which timestamp is after the other. On a tie neither branch runs, the merge returns having changed nothing, and the two replicas keep different values while reporting success. Divergence is silent and permanent.

[`RGA`](../../packages/entities/src/RGA.ts) already worked around this by breaking ties on the row key, and recorded why in a comment on `outranks`: `Time` carried no replica of its own. The workaround is local to `RGA`; nothing protected `LWWRegister`.

The Hybrid Logical Clock as described in [Kulkarni et al. (2014)](../notes/research/hybrid-logical-clocks.md) carries a node identity per clock. Ours did not.

## Decision

Every `Time` carries the identity of the replica that minted it, and ordering is total.

`Time.compare` orders by physical time, then logical time, then replica. `isAfter` is defined as `compare(other) > 0`, so for any two distinct timestamps exactly one direction is after. `LWWRegister.merge` needs no change: its existing branches become exhaustive, and the remaining no-op case is the same write arriving twice.

The replica identity is a UUID v4 from [`ID.create()`](../../packages/id/src/ID.ts), under [ADR-02](./ADR-02-use-uuid-v4-for-generated-identities.md). We considered a shorter 64-bit identifier to keep timestamps small and rejected it: a second identity format would mean a second entropy and secure-context story to audit, for a saving that interning addresses better.

A timestamp serializes as `<ISO 8601 time>+<hex counter>+<replica>`. All three parts are fixed width, so the string still sorts lexicographically in the order `compare` computes. `fromTimestamp` requires all three and does not default a missing replica, because a defaulted one is indistinguishable from a replica that lost its tiebreak.

The process mints an identity eagerly at module load. `Time.setReplicaId` adopts a stored one, and `Time.getReplicaId` reads the current one, which is what lets a host persist the generated identity on first run. Adoption is not guarded: a `Time` keeps the identity it was constructed with, so adopting late leaves already-minted stamps claiming the previous one. Hosts adopt during boot, before the first write.

We call this a _replica_, not a _node_. The codebase already uses "replica" for this concept throughout `RGA` and its tests, and "node" is taken by Node.js. Readers moving between this record, the research note and the paper should know the literature says "node", Automerge says "actor" and Yjs says "client".

## Alternatives considered

**Break ties in each entity, as `RGA` does.** Keeps `Time` smaller, but every current and future conflict resolver has to remember to do it, and each needs a tiebreaker that happens to be available and stable. `LWWRegister` has no such field. Putting the identity in the stamp fixes every consumer at once.

**Vector clocks.** They would make the order causally complete, so concurrent writes could be _detected_ rather than silently resolved. We rejected them for now because state grows with the number of replicas a document has ever seen, and because this library resolves conflicts rather than surfacing them. A Hybrid Logical Clock gives `e hb f ⇒ hlc.e < hlc.f` and not the converse; see the research note.

**Constructor-injected clock instead of process state.** This is the better long-term shape and is where the receive rule belongs, but it changes every entity constructor. We kept the existing process-wide clock here so that the divergence fix lands on its own.

## Consequences

Merges converge. Two replicas that stamp the same instant now resolve deterministically and identically on both sides, whichever order they merge in.

Timestamps grow from 30 to 67 characters. Each `ElementRecord` carries two of them and each `RGA` element key and tombstone key carries one, so a sequence costs roughly 40 more characters per element in storage and in memory. Over the wire the replica repeats in every stamp and compresses away. If the in-memory cost matters, interning one shared replica string is the lever, not a shorter identity.

The serialized format is incompatible with the previous two-part form. No released version emits either, so there is no migration; stored data written before this change must be discarded.

A process that never calls `setReplicaId` is a new replica on every start. That is safe — a fresh UUID never collides, and merges stay deterministic — but the set of distinct identities in the data then grows with session count rather than device count, interning stops helping, and there is no stable identity to hang per-peer sync state or debugging on. Hosts should persist the identity and adopt it during boot, before the first write.

Adopting an identity after the first write is a silent mistake. The stamps already issued keep the old identity, so one session writes under two, and nothing reports it. We considered refusing a late adoption and rejected it: the guard needs state that exists only to police a call hosts make once, in a place they control, and the failure it catches is a boot-ordering bug that a host notices on its first merge.

`Time` now depends on `@nn/id`, so importing it requires `crypto.randomUUID()` at module load rather than at first use. In a non-secure browser context this turns a first-write failure into an import failure.

`RGA.outranks` keeps its key tiebreak. It is now reachable only through a restored or duplicated identity, and it keeps the order total when one occurs.

The receive rule is still missing: nothing outside `RGA`'s private clock advances a replica's clock when it observes a remote timestamp. `LWWRegister` therefore still cannot guarantee that a local write following a remote one outranks it. That is tracked separately and is not addressed here.
