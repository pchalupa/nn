# Hybrid Logical Clocks: what they actually guarantee, and what a local-first client should do with them

Research date: **2026-10-03**. Primary sources read in full or in the cited part:

- **The paper**: Kulkarni, Demirbas, Madeppa, Avva, Leone, _"Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases"_, University at Buffalo tech report **2014-04**, read as [PDF][paper] (6 pages, text extracted and read end to end). The peer-reviewed version is OPODIS 2014, [doi:10.1007/978-3-319-14472-6_2][paper-doi]; Springer blocked automated access, so the pagination of that version is **not verified here** and every quote below is from the tech report. Note the spelling of the third author: the tech report says **Madeppa**, not "Madappa".
- **CockroachDB**, `cockroachdb/cockroach` at commit `d30c905fff79ef825adc96bcc647f1872a90f2ff` (shallow sparse clone, 2026-10-03): `pkg/util/hlc/{doc.go,hlc.go,timestamp.go,timestamp.proto}`, `pkg/kv/kvserver/uncertainty/doc.go`, `pkg/server/{clock_monotonicity.go,config.go}`, `pkg/base/constants.go`, `pkg/rpc/clock_offset.go`.
- **Evolu**, `evoluhq/evolu` at `f082fdd974e25fa0eb1134e4b34f15b740af8fe2`: `packages/common/src/local-first/Timestamp.ts`, `packages/common/src/Time.ts`.
- **Jazz**, `garden-co/jazz` at `71aecb6d275a1ec3dad737ccbf1c0a6a5ecdbbed`: `crates/jazz/layers/types/src/time.rs`, `crates/jazz/layers/model/src/tx.rs`, `crates/jazz/layers/node/src/node/{mod.rs,ingest/commit_bundles.rs}`.
- **James Long's `crdt-example-app`** at `9318b1c5e8c5893316d571b1c3a9db9359e55990`: `shared/timestamp.js`, `client/{clock.js,sync.js}`. Its maintained descendant, **Actual Budget** `actualbudget/actual` at `b490e3e76e43dd0920445bc1a2382afe7c99fbf8`: `packages/crdt/src/crdt/timestamp.ts`.
- **MongoDB**, `mongodb/mongo` at `23483951d618f7d87648211499cf05b2f38991ce`: `src/mongo/db/logical_time.h`, `src/mongo/db/topology/vector_clock/{vector_clock.h,vector_clock.cpp,vector_clock_mutable.cpp,vector_clock_document.idl}`.
- **Spanner**: Corbett et al., _"Spanner: Google's Globally-Distributed Database"_, [ACM TOCS 31(3) art. 8][spanner-pdf] (the extended journal version of the OSDI 2012 paper), §3 and §4.1.2.
- **Automerge** at `07307081183252ed5522f1966d734d4e8329456b` (`rust/automerge/src/types.rs`) and **Yjs** at `4d75cc8e4024dbb1f554737aa93c68b2e54adebe` (`src/utils/ID.js`, `INTERNALS.md`) — read to establish that they are _not_ HLC.
- **ElectricSQL** at `236293974902a08990ffc9ece5ab6ce58d76cd84` and **RxDB** at `f34569d787d543d6ea2cb7799a1dfd7520b3aa27` — read to establish the same.
- Specs: [W3C High Resolution Time][hrtime] §4 and §9.1.
- Secondary, flagged as such where used: [Jepsen's CockroachDB beta-20160829 analysis][jepsen], Kyle Kingsbury's ["The trouble with timestamps"][aphyr] (which the HLC paper itself cites as reference [8]), MDN on [`performance.now()`][mdn-now].

Companions in this directory: [Array-like CRDTs](array-like-crdts.md), [Map- and object-like CRDTs](map-object-crdts.md), [ID generation in distributed systems](distributed-id-generation.md), [Local-first software](local-first-software.md). This note does not repeat what those cover; it covers the clock.

---

## Short answer

An HLC is a pair `⟨l, c⟩` where `l` tracks the largest physical-clock reading anybody in the system has told you about, and `c` is a small integer that only ticks while `l` is standing still. Compare them lexicographically. That is the whole idea. [Paper, Fig. 5][paper]

What it buys you over a **Lamport clock** is that `l` stays within the clock-synchronization uncertainty `ε` of real physical time — the paper proves `l.f ≥ pt.f` (Theorem 2) and `|l.f − pt.f| ≤ ε` (Corollary 1) — so you can ask "what did the database look like at 14:02?" and get a meaningful, _consistent_ answer. A Lamport clock number is an integer with no relationship to the wall at all. What it buys you over a **plain wall clock** is the one-way causality property `e hb f ⇒ (l.e, c.e) < (l.f, c.f)` (Theorem 1), which a wall clock does not have: a node with a slow clock can time-stamp a write it made _after_ reading yours with a number _below_ yours, and a last-writer-wins register will then silently discard it. That failure is the subject of the paper's own cited reference [8]. [Paper §3.3][paper] [aphyr][aphyr]

The cost is that `c` must be bounded, which is exactly what the two-field split is for. The naive one-field version (`l := max(l + 1, pt)`) loses the information about _why_ `l` grew, so there is never a safe moment to reset, and `l − pt` diverges without bound under a message loop — the paper's Figure 4 counterexample. Splitting out `c` gives a reset point: whenever physical time catches up and advances `l`, `c` drops to 0. The paper bounds `c ≤ N·(ε + 1)` in general (Corollary 3) and `c ≤ ε/d + 1` if every message takes at least `d` physical ticks (Corollary 4); in their 16-node AWS experiment `c` never exceeded 7. [Paper §3.2–§3.3, §5.1][paper]

**For a local-first client library, the three things that matter most are not in the paper.** First, you need a **node ID as the final tie-break**, because `⟨l, c⟩` alone is not unique across replicas and an LWW register that treats a tie as "no change" diverges silently. Every real implementation adds one: CockroachDB does it outside the timestamp, Evolu and Jazz put it in the sort key, `crdt-example-app` concatenates 16 hex characters onto the string. Second, you need a **drift policy** — the paper's `ε` is "NTP on datacenter machines", roughly milliseconds; a user's phone can be set to the wrong _year_. Third, you need to decide **what to do with a timestamp from the future**, because accepting it poisons your own clock forever (the clock never goes back) and rejecting it loses a write. Evolu quarantines; Jazz's server rejects with `ClientClockTooFarAhead` past 30 s; `crdt-example-app` throws `ClockDriftError` past 5 minutes; CockroachDB returns an "untrustworthy remote wall time" error past `max_offset`. [`Timestamp.ts`][evolu-ts] [`commit_bundles.rs`][jazz-ingest] [`timestamp.js`][jl-ts] [`hlc.go`][crdb-hlc]

And the thing HLC emphatically does **not** give you: the converse. `hlc.e < hlc.f` does **not** imply `e hb f`. The paper states the implication in one direction only and explicitly lists `e hb f ⇐ lc.e < lc.f` among "claims [that] are not true" for logical clocks. HLC inherits that. So HLC can _resolve_ a conflict (pick a winner deterministically) but cannot _detect_ one (tell you two writes were concurrent so you can ask the user). Only a vector clock gives `e hb f ⇔ vc.e < vc.f`, at `O(nodes)` space. This is the single most-misunderstood point about HLC. [Paper §2][paper]

This repo already has an HLC in `packages/time/src/Time.ts`, and §9 below checks it against the paper. The short version: it is a correct _send_ rule with no _receive_ rule and no drift bound. The missing replica tie-break was closed by [ADR-09](../../decisions/ADR-09-stamp-times-with-a-replica-identity.md); §9 records what that changed and what is still open.

---

## 1. The original algorithm, exactly as published

### 1.1 Problem statement

The paper asks for a timestamp `l.e` per event satisfying four requirements, quoted verbatim:

> 1. `e hb f ⇒ l.e < l.f`,
> 2. Space requirement for `l.e` is `O(1)` integers,
> 3. `l.e` is represented with bounded space,
> 4. `l.e` is close to `pt.e`, i.e., `|l.e − pt.e|` is bounded.

Requirement 2 carries a rider that matters: "To prevent encoding of several integers into one large integer, we require that any update of `l.e` is achieved by `O(1)` operations." That rules out the vector-clock answer.

`hb` is Lamport's happened-before: same node and earlier, or send/receive of the same message, or the transitive closure. `e || f` ("concurrent") means neither `e hb f` nor `f hb e`.

### 1.2 The naive version, and why it fails

```text
# Figure 3: Naive HLC algorithm for node j
Initially l.j := 0

Send or local event
  l.j := max(l.j + 1, pt.j)
  Timestamp with l.j

Receive event of message m
  l.j := max(l.j + 1, l.m + 1, pt.j)
  Timestamp with l.j
```

This is a Lamport clock floored at physical time. It satisfies requirements 1 and 2 and fails 3 and 4. The paper's reason is precise and worth internalising:

> The root of the unbounded drift problem is due to the naive algorithm using `l` to maintain both the maximum of `pt` values seen so far and the logical clock increments from new events (local, send, receive). This makes the clocks lose information: it becomes unclear if the new `l` value came from `pt` [...] or from causality [...]. As such, there is no suitable place to reset `l` value to bound the `l − pt` difference, because resetting `l` may lead to losing the `hb` relation, and, hence, a violation of requirement 1.

Figure 4 is a three-node message loop that pumps `l − pt` up forever. The paper notes the counterexample survives even if you assume physical clocks advance by at least 1 between any two events on a node; it fails only if you additionally assume every _message_ takes at least one physical tick.

### 1.3 The real algorithm

```text
# Figure 5: HLC algorithm for node j
Initially l.j := 0; c.j := 0

Send or local event
  l'.j := l.j;
  l.j  := max(l'.j, pt.j);
  If (l.j = l'.j) then c.j := c.j + 1
  Else c.j := 0;
  Timestamp with l.j, c.j

Receive event of message m
  l'.j := l.j;
  l.j  := max(l'.j, l.m, pt.j);
  If      (l.j = l'.j = l.m) then c.j := max(c.j, c.m) + 1
  Else if (l.j = l'.j)       then c.j := c.j + 1
  Else if (l.j = l.m)        then c.j := c.m + 1
  Else c.j := 0
  Timestamp with l.j, c.j
```

Two things changed from the naive version. The `+1` inside the `max` is gone, so `l` is _purely_ "the largest physical reading I know of" and never grows for causality reasons alone. And `c` absorbs the causality increments, with a reset to 0 the moment `l` moves — which happens, within bounded time, either because a bigger `l` arrives in a message or because the node's own `pt` catches up.

Comparison is lexicographic, defined in the paper's footnote 3:

> `(a, b) < (c, d)` iff `((a < c) ∨ ((a = c) ∧ (b < d)))`

### 1.4 What is proved, and under what assumptions

The assumptions are stated across §3 and §5: physical clocks are synchronized to within `ε` (so you cannot have `e hb f` with `pt.e > pt.f + ε`); a node's physical clock advances by at least 1 between any two events on that node; and, for the tighter counter bound only, every message transmission takes at least `d` physical ticks. There is **no** bound on message delay anywhere — HLC inherits Lamport's asynchrony, which is the point.

| Result             | Statement                                 | Meaning                                                                   |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| Theorem 1          | `e hb f ⇒ (l.e, c.e) < (l.f, c.f)`        | one-way causality, as for LC                                              |
| Theorem 2          | `l.f ≥ pt.f`                              | the logical clock is never behind the local wall clock                    |
| Theorem 3          | `l.f > pt.f ⇒ (∃g : g hb f ∧ pt.g = l.f)` | if `l` is ahead, some causal ancestor's physical clock actually read that |
| Corollary 1        | `\|l.f − pt.f\| ≤ ε`                      | combine Thm 3 with the clock-sync assumption                              |
| Theorem 4 / Cor. 2 | `c.f ≤ \|{g : g hb f ∧ l.g = l.f}\|`      | `c` counts causal ancestors sharing the same `l`                          |
| Corollary 3        | `c.f ≤ N·(ε + 1)`                         | `N` nodes, `ε` ticks each                                                 |
| Corollary 4        | `c.f ≤ ε/d + 1`                           | under the message-delay assumption                                        |

Corollary 1 is the one people quote and the one with the sharpest practical edge. Combined with Theorem 2 it says `l − pt ∈ [0, ε]`: **an HLC is never behind physical time and never more than one clock-skew bound ahead of it.** Everything downstream — consistent snapshots, "read as of 14:02", using HLC as a drop-in for NTP time — rests on that.

### 1.5 Measured, not just proved

The paper's §5.1 AWS numbers are the useful sanity check, because the theoretical `c` bounds are loose:

| Deployment                        | NTP offset | `c = 0` | max `c` observed | max `l − pt` |
| --------------------------------- | ---------- | ------- | ---------------- | ------------ |
| 4 × m1.xlarge, 1 region           | 5 ms       | 83.90 % | 3                | 21.7 ms      |
| 8 × m1.xlarge, 1 region           | 9 ms       | 65.56 % | 9                | 107.9 ms     |
| 8 × m1.xlarge, 1 region           | 3 ms       | 91.18 % | 1                | 7.4 ms       |
| 16 × m1.xlarge, 1 region          | 16 ms      | 66.96 % | 7                | 90.5 ms      |
| 4 nodes, WAN (IE/US-E/US-W/Tokyo) | 3 ms       | ~95 %   | 1                | 0.02 ms      |

The WAN row is the interesting one and the paper explains it: "when a message is received, its `l` timestamp is already in the past and is smaller than the `l` value at the receiver which is updated by its `pt`." **Long network delays make HLC behave like a plain wall clock; short delays are what exercise the logical component.** For a local-first client syncing over the open internet, `c` will almost always be 0 or 1 across devices — the counter earns its keep for _rapid local events within one millisecond_, not for cross-device skew.

Also from §5.2, and directly relevant to multi-device sync: a "straggler" (slow clock) hurts itself far more than the cluster. A node 5ε behind reached `c = 514` _on itself_, while "the straggler node did not raise the `c` values of other nodes in the system." A "rusher" (fast clock) produced a maximum `c` of 8 anywhere. Asymmetric, and in the direction you want.

---

## 2. Why HLC exists: what LC, VC and NTP each fail at

The paper's §2 lays out the ground truth as a table of what is and is not implied. Reproduced exactly:

> Based on the existing results in the literature, the following are true:
> `e hb f ⇒ lc.e < lc.f`
> `lc.e = lc.f ⇒ e||f`
> `e hb f ⇔ vc.e < vc.f`
>
> However, the following claims are not true:
> `e hb f ⇐ lc.e < lc.f`
> `lc.e = lc.f ⇐ e||f`
> `e hb f ⇒ pt.e < pt.f`

Read the last line carefully. **Physical timestamps do not respect causality.** Not "usually do"; the implication simply does not hold. That is the entire case against wall-clock LWW.

**Lamport clocks** (§1.1). Two complaints: "1) Using LC, it is not possible to query events in relation to physical time. 2) For capturing `hb`, LC assumes that all communication occurs in the present system and there are no backchannels. This is obsolete for today's integrated, loosely-coupled system of systems." The backchannel point is sharp for local-first: a user reads a value on their laptop and types it into their phone. No message passes between the replicas, so no logical clock can see the dependency — but both devices' wall clocks did advance, and HLC's `l` component captures it where a bare Lamport counter cannot.

**Vector clocks** (§1.1). They give the biconditional — true concurrency detection — and the paper says VC "finds all possible consistent snapshots, which is useful for debugging applications." The objection is only cost: "the space requirement of VC is on the order of nodes in the system, and is prohibitive." In a local-first system "nodes" means every device every user ever installed the app on, which never shrinks, so this objection bites harder here than in a datacenter.

**Plain NTP physical time** (§1.1). Two failure modes, quoted: "1) When the uncertainty intervals are overlapping, PT cannot order events. NTP can usually maintain time to within tens of milliseconds over the public Internet [...] however, asymmetric routes and network congestion can occasionally cause errors of 100 ms or more. 2) PT has several kinks such as leap seconds and non-monotonic updates to POSIX time which may cause the timestamps to go backwards."

The concrete harm of #2 is in the paper's own reference [8], Kingsbury's "The trouble with timestamps", which is **a blog post, not a peer-reviewed source** — flagged as secondary. Its argument: with LWW keyed on wall time, process B can read a value written at `t=2`, write its own update at `t=1` because B's clock is behind, and that update is "gone _forever_. It might survive on an isolated node for a bit, but eventually the Cassandra or Riak LWW rules will ensure it's destroyed." Its conclusion: "Timestamps, as implemented in Riak, Cassandra, et al, are fundamentally unsafe ordering constructs." HLC fixes precisely this case: B's clock would have been pulled forward to `l = 2` when it read, so its write stamps `⟨2, 1⟩ > ⟨2, 0⟩`.

**HLC's own framing** (§1.2, bulleted contributions): it "preserves the property of logical clocks (`e hb f ⇒ hlc.e < hlc.f`) and as such HLC can identify and return consistent global snapshots without needing to wait out clock synchronization uncertainties and without needing prior coordination, in a posteriori fashion"; it "works as a superposition on the NTP protocol (i.e., HLC only reads the physical clocks and does not update them)". The superposition property is not decorative — §3.4 explains that it is what makes self-stabilization possible, since NTP is left free to correct the physical clock underneath, and it avoids "the potential problem where clocks of nodes are synchronized with each other even though they drift substantially from real wall-clock."

---

## 3. Comparison, tie-breaking, and why a node ID is not optional

Comparison is lexicographic on `⟨l, c⟩` (paper, footnote 3). Two events can tie. The paper is relaxed about this because it _wants_ ties: `l.e = l.f ⇒ e || f` is the property that makes `⟨l = t, c = 0⟩` a consistent cut across all nodes (§3.1, §6.1). For snapshots, ties are a feature.

For an LWW register they are a bug. If replica A holds `⟨100, 0⟩ = "red"` and replica B holds `⟨100, 0⟩ = "blue"`, a merge rule phrased as "take the strictly greater timestamp" does nothing on either side and the replicas **stay different while reporting that they merged**. Convergence is lost. So every implementation that uses HLC for conflict resolution extends the key:

| System                      | Ordering key                   | Tie-break                                                              |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Paper                       | `⟨l, c⟩`                       | none (ties are intentional)                                            |
| CockroachDB                 | `⟨WallTime, Logical⟩`          | none _in the timestamp_; MVCC keys and transaction IDs disambiguate    |
| Evolu                       | `⟨millis, counter, nodeId⟩`    | 64-bit random node ID, hex string compare [`orderTimestamp`][evolu-ts] |
| Jazz                        | `TxTimeSortKey { time, node }` | `NodeUuid` [`time.rs`][jazz-time]                                      |
| `crdt-example-app` / Actual | the formatted string           | last 16 chars are the node ID                                          |
| This repo                   | `⟨time, counter⟩`              | **none** — see §9                                                      |

The `crdt-example-app` trick is worth copying because it makes the tie-break free. `Timestamp.toString()` emits three fixed-width fields joined by `-`:

`crdt-example-app/shared/timestamp.js`, commit `9318b1c`:

```js
toString() {
  return [
    new Date(this.millis()).toISOString(),
    (
      '0000' +
      this.counter()
        .toString(16)
        .toUpperCase()
    ).slice(-4),
    ('0000000000000000' + this.node()).slice(-16)
  ].join('-');
}
```

ISO-8601 with a fixed `Z` offset sorts lexicographically in time order; the counter is 4 zero-padded uppercase hex digits; the node is 16 zero-padded characters. So `m1.timestamp < m2.timestamp` as **plain JavaScript string comparison** is exactly `⟨millis, counter, node⟩` lexicographic order — which is what `sync.js` relies on:

`crdt-example-app/client/sync.js`, commit `9318b1c`:

```js
if (!existingMsg || existingMsg.timestamp < msg.timestamp) {
	apply(msg);
}
```

Evolu does the same thing in bytes rather than text — see §4.

One caveat the string form hides: the node ID is only a _deterministic_ tie-break, not a _correct_ one. If two devices genuinely write the same field in the same logical millisecond with the same counter, whichever node ID sorts higher wins, and the other user's edit is gone with no signal. Evolu's own documentation is unusually honest that this is a known, accepted limitation and that it cannot be fixed by a better tie-break:

> Vector clocks can accurately track causality and detect concurrent operations, but they require unbounded space in peer-to-peer systems and crucially, still don't solve our fundamental problem: when they detect operations as concurrent, we still need a deterministic way to choose a winner. Additionally, any deterministic conflict resolution can be gamed by malicious actors.

This connects to [`map-object-crdts.md`](map-object-crdts.md): LWW is a _policy_, and HLC only supplies the ordering the policy consumes. If the application needs "both edits survive", the answer is a different CRDT (OR-Set, MV-Register, a sequence), not a better clock.

---

## 4. Encoding: five real wire formats

The paper's §6.2 proposes one, and it is the ancestor of most of the others:

> This scheme involves restricting `l` to track only the most significant 48 bits of `pt` in the HLC algorithm presented in Figure 5. Rounding up `pt` values to 48 bits `l` values still gives us microsecond granularity tracking of `pt`. [...] The way we round up `pt` is to always take the ceiling to the 48th bit. [...] 16 bits remain for `c` and allows it room to grow up to 65536, which is more than enough as we show in our experiments.

48 + 16 = 64 bits, deliberately the same width as an NTP timestamp, "important because many distributed database systems and distributed key-value stores use NTP clocks to timestamp and compare records." Note the **ceiling**, not truncation: rounding `pt` up preserves `l ≥ pt` (Theorem 2). Several implementations that copied the 48/16 split did not copy the ceiling, and quietly weakened Theorem 2 by up to one unit — harmless in practice, but it is a divergence.

### 4.1 Evolu — 48/16/64, 16 bytes, byte-sortable

`evolu/packages/common/src/local-first/Timestamp.ts`, commit `f082fdd`:

```ts
export const timestampToTimestampBytes = (timestamp: Timestamp): TimestampBytes => {
	const { millis, counter, nodeId } = timestamp;

	// 6 bytes for millis, 2 bytes for counter, 8 bytes for nodeId.
	const value = new globalThis.Uint8Array(16);
	// ... big-endian millis into value[0..5], counter into value[6..7] ...
	value.set(nodeIdToNodeIdBytes(nodeId), 8);
	return value as TimestampBytes;
};

export const orderTimestampBytes: Order<TimestampBytes> = orderUint8Array;
```

Big-endian throughout, so `memcmp` on the 16 bytes _is_ the total order — the same property as the `crdt-example-app` string, at 16 bytes instead of ~45. The 48-bit ceiling on milliseconds is enforced by the type: `maxMillisWithInfinity = 281474976710655` (`2^48 − 1`), with the comment "`new Date(281474976710654).toString()` = Tue Aug 02 10889 07:31:49" and "If a system clock exceeds this range, operations will throw. This is intentional — there's no reasonable fallback for a misconfigured clock."

Evolu's docs explicitly record the divergence from the paper: "The paper proposes 48 significant bits of an NTP timestamp plus a 16-bit counter and argues that the counter is sufficient under its assumptions. Evolu uses 48-bit milliseconds and rolls counter exhaustion into the next logical millisecond, subject to the timestamp range."

### 4.2 Jazz — 46/18 packed into one `u64`

`jazz/crates/jazz/layers/types/src/time.rs`, commit `71aecb6`:

```rust
/// The packed HLC has 46 physical Unix-millisecond bits and 18 logical bits.
/// This reaches year 4200 while allowing 262,144 causally ordered ticks in one
/// millisecond on one node.
pub const HLC_PHYSICAL_BITS: u64 = 46;
pub const HLC_COUNTER_BITS: u64 = 64 - HLC_PHYSICAL_BITS;
```

`TxTime(pub u64)` derives `Ord`, so integer comparison is the HLC comparison; the node ID lives alongside in `TxId { time: TxTime, node: NodeUuid }`. A test pins the byte-level ordering through the storage layer, which is the right thing to test:

```rust
assert_eq!(TxTime::new(0, HLC_MAX_LOGICAL_COUNTER).0, 0x0000_0000_0003_ffff);
assert_eq!(TxTime::new(1, 0).0,                       0x0000_0000_0004_0000);
assert!(TxTime::new(0, HLC_MAX_LOGICAL_COUNTER) < TxTime::new(1, 0));
```

Trading 2 bits of range (year 4200 instead of 10889) for 2 bits of counter (262 143 instead of 65 535) is a reasonable call for a client that may burst many operations inside one millisecond.

### 4.3 CockroachDB — 64 + 32, not packed

`cockroachdb/cockroach/pkg/util/hlc/timestamp.proto`, commit `d30c905`:

```proto
message Timestamp {
  // Holds a wall time, typically a unix epoch time expressed in
  // nanoseconds.
  int64 wall_time = 1;
  // The logical component captures causality for events whose wall times
  // are equal. It is effectively bounded by (maximum clock skew)/(minimal
  // ns between events) and nearly impossible to overflow.
  int32 logical = 2;
  reserved 3;
}
```

96 bits, nanosecond physical resolution, no packing — a server has no reason to squeeze. The comment restates the paper's Corollary 4 (`c ≤ ε/d + 1`) in engineering terms. Human-readable form is `seconds.nanos,logical`, e.g. `1234.000000005,1`.

### 4.4 MongoDB cluster time — 32 seconds + 32 increment

MongoDB reuses the BSON `Timestamp` (32-bit seconds since epoch, 32-bit increment) as `LogicalTime`, gossiped on every message as `$clusterTime`/`operationTime`. The physical component is only **second**-granular, so the increment carries far more weight than in the other designs. `VectorClockMutable::_advanceComponentTimeByTicks` is the send rule:

`mongodb/mongo/src/mongo/db/topology/vector_clock/vector_clock_mutable.cpp`, commit `2348395`:

```cpp
    // Synchronize time with wall clock time, if time was behind in seconds.
    if (timeSecs < wallClockSecs) {
        time = LogicalTime(Timestamp(wallClockSecs, 0));
    }
    // If reserving 'nTicks' would force the time's increment field to exceed (2^31-1),
    // overflow by moving to the next second. ...
    else if (time.asTimestamp().getInc() > (kMaxValue - nTicks)) {
        // Move time forward to the next second
        time = LogicalTime(Timestamp(time.asTimestamp().getSecs() + 1, 0));
    }
```

Naming trap: the C++ class is called `VectorClock`, but it is **not** a vector clock in the Fidge/Mattern sense. It is an array of three independent HLCs — `enum class Component : uint8_t { ClusterTime = 0, ConfigTime = 1, TopologyTime = 2 }` — one per subsystem, not one per node. It gives you no concurrency detection.

### 4.5 `crdt-example-app` / Actual Budget — the fixed-width string

Covered in §3. ~45 ASCII characters, enormous next to 16 bytes, but it survives JSON, SQLite `TEXT` columns and `ORDER BY` with nothing but the default collation, which is why it spread. Actual Budget still ships it essentially unchanged at `b490e3e`, with `MAX_COUNTER = parseInt('0xFFFF')` and `maxDrift: 5 * 60 * 1000`.

---

## 5. Real implementations, and who does _not_ use HLC

| System                             | Mechanism                                                                  | HLC?                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| CockroachDB                        | `⟨int64 nanos, int32 logical⟩`, `max_offset` 500 ms, uncertainty intervals | **Yes**, cites the paper in `doc.go`                                |
| MongoDB cluster time               | `⟨uint32 secs, uint32 inc⟩` per component, HMAC-signed                     | **Yes** in structure, not by that name                              |
| Jazz                               | `TxTime` = 46/18 packed `u64` + `NodeUuid`                                 | **Yes**, named HLC in source                                        |
| Evolu                              | `⟨48-bit millis, 16-bit counter, 64-bit nodeId⟩`                           | **Yes**, cites the paper                                            |
| Actual Budget / `crdt-example-app` | millis + 16-bit counter + 16-char node, as a string                        | **Yes**                                                             |
| Automerge                          | `OpId(counter: u32, actor: u32)`                                           | No — **pure Lamport**                                               |
| Yjs                                | `ID { client, clock }`                                                     | No — **Lamport / state vector**                                     |
| ElectricSQL (current)              | Postgres LSN + xmin snapshots                                              | No — **server log order**                                           |
| Replicache / Zero                  | per-client sequential mutation IDs + server cookie, rebase                 | No — **server-authoritative**                                       |
| RxDB                               | revision `height-hash`                                                     | No — **revision height** (its docs say "similar to Lamport Clocks") |
| Spanner                            | TrueTime intervals + commit-wait                                           | No — see §6                                                         |

### 5.1 CockroachDB

`pkg/util/hlc/doc.go` opens by naming the paper, and the implementation is the paper's algorithm with the `+1`s left out at the receive end. The send/local rule:

`cockroachdb/cockroach/pkg/util/hlc/hlc.go`, commit `d30c905`:

```go
func (c *Clock) NowAsClockTimestamp() ClockTimestamp {
	physicalClock := c.getPhysicalClockAndCheck(context.TODO())
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.mu.timestamp.WallTime >= physicalClock {
		// The wall time is ahead, so the logical clock ticks.
		c.mu.timestamp.Logical++
	} else {
		// Use the physical clock, and reset the logical one.
		atomic.StoreInt64(&c.mu.timestamp.WallTime, physicalClock)
		c.mu.timestamp.Logical = 0
	}
	c.enforceWallTimeWithinBoundLocked()
	return c.mu.timestamp
}
```

That is Figure 5's send rule verbatim. The receive rule is **not**:

```go
func (c *Clock) Update(rt ClockTimestamp) {
	// ... fast path elided ...
	if rt.WallTime > c.mu.timestamp.WallTime {
		atomic.StoreInt64(&c.mu.timestamp.WallTime, rt.WallTime)
		c.mu.timestamp.Logical = rt.Logical
	} else if rt.WallTime == c.mu.timestamp.WallTime {
		if rt.Logical > c.mu.timestamp.Logical {
			c.mu.timestamp.Logical = rt.Logical
		}
	}
}
```

**Divergence from the paper, deliberate.** Figure 5 computes a timestamp _for the receive event itself_, which must be strictly greater than both `l.e` and `l.m`, so it adds 1 to the counter. `Update` merely joins the clock state with the incoming reading and adds nothing. It is also not a three-way max — it never consults the physical clock, which `UpdateAndCheckMaxOffset` does separately. This is sound in CockroachDB's model because the _receipt_ is not itself a timestamped event: the next call to `Now()` always ticks (note `>=`, not `>`), so any event causally after the message still gets a strictly greater timestamp. If you port `Update` into a system where receiving a message _is_ an event you stamp, you lose Theorem 1.

**Max offset and what happens past it.** `base.DefaultMaxClockOffset = 500 * time.Millisecond`. (Jepsen's 2016 analysis reports "the default threshold of 250 milliseconds"; that is a **secondary source describing a 2016 build** and the default has since doubled — a good illustration of why to read the constant, not the write-up.) The offset is a _promise by the operator_, per the field comment: "the maximal clock skew between any two nodes in the cluster, as promised by the operator."

Three separate defences:

1. **Reject untrustworthy incoming readings.** `UpdateAndCheckMaxOffset` returns `errUntrustworthyRemoteWallTimeErr` ("remote wall time is too far ahead to be trustworthy") when `rt.WallTime - physicalClock > maxOffset`, and does not advance the clock.
2. **Detect local jumps.** `checkPhysicalClock` logs a warning and bumps `monotonicityErrorsCount` on a backward jump larger than `maxOffset/10`, and **`Fatalf`s** — kills the process — on a forward jump beyond `toleratedForwardClockJump() = maxOffset / 2`, when the check is enabled.
3. **Self-terminate if the node is the odd one out.** `(rpc.RemoteClockMonitor).VerifyClockOffset` returns an error — "this node's clock is unreliable, and [...] the node should terminate" — when `healthyOffsetCount <= numClocks/2`, measured against `toleratedOffset`, which `pkg/server/config.go` sets to `toleratedOffsetMultiplier = 0.8` times `MaxOffset`, "to avoid exceeding MaxOffset".

**What breaks if the promise is broken.** `doc.go` is unusually candid, with explicit `HAZARD:` paragraphs. The important one:

> HAZARD: If the maximum clock offset is exceeded, it is possible for a transaction to serve a stale read that violates single-key linearizability. [...] Notably, this is a violation of consistency (linearizability) but not of isolation (serializability) — transaction isolation has no clock dependence.

That last clause is the correct mental model and it is also the right one for a CRDT library: **clock skew corrupts your ordering, not your convergence.** Replicas still agree; they may agree on the wrong winner.

**Uncertainty intervals**, the mechanism that converts bounded skew into a real guarantee, live in `pkg/kv/kvserver/uncertainty/doc.go`. A transaction gets `[commit_ts, commit_ts + max_offset]`; a value found above `commit_ts` but inside the interval triggers an _uncertainty restart_ rather than being ignored, "treating all values in a transaction's uncertainty window as past writes." Observed timestamps — a clock reading taken the first time a transaction visits each node — shrink the interval per node and avoid most restarts.

**Persistence across restarts.** `pkg/server/clock_monotonicity.go` sleeps on boot, with a comment that states the local-first version of the problem exactly:

```go
	} else {
		// Previous HLC Upper bound is not known
		// We might have to sleep a bit to protect against this node producing non-
		// monotonic timestamps. Before restarting, its clock might have been driven
		// by other nodes' fast clocks, but when we restarted, we lost all this
		// information. ...
		sleepUntil = startTime.UnixNano() + int64(clock.MaxOffset()) + 1
	}
```

If `server.clock.persist_upper_bound_interval` is on, it instead sleeps to the persisted bound; `doc.go` notes "this protection is disabled by default."

### 5.2 Jazz

Jazz's `tick_packed` is the send rule plus an overflow policy:

`jazz/crates/jazz/layers/types/src/time.rs`, commit `71aecb6`:

```rust
fn tick_packed(
    registered_physical_ms: u64,
    registered_counter: u32,
    now_ms: u64,
) -> Result<(u64, u32), HlcOverflow> {
    if now_ms > registered_physical_ms {
        if now_ms > HLC_MAX_PHYSICAL_MS { return Err(HlcOverflow { physical_ms: HLC_MAX_PHYSICAL_MS }); }
        return Ok((now_ms, 0));
    }
    if registered_counter < HLC_MAX_LOGICAL_COUNTER {
        return Ok((registered_physical_ms, registered_counter + 1));
    }
    let physical_ms = registered_physical_ms.checked_add(1).ok_or(/* ... */)?;
    // ...
    Ok((physical_ms, 0))
}
```

Counter exhaustion borrows a millisecond from the future rather than failing. Server-side ingest rejects client timestamps too far ahead, with `SKEW_TOLERANCE_MS = 30_000`:

`jazz/crates/jazz/layers/node/src/node/ingest/commit_bundles.rs`, commit `71aecb6`:

```rust
        if tx.tx_id.time.physical_ms() > now_ms.saturating_add(SKEW_TOLERANCE_MS) {
            let fate = Fate::Rejected(RejectionReason::ClientClockTooFarAhead);
```

Also worth noting for browser deployments, from `default-runtime-source.ts`: each foreground tab gets a **fresh random node ID**, because "Reusing a deterministic node across independently opened tabs would let their fresh HLC registers mint the same TxId before either has observed the other's first commit." Multiple tabs are multiple replicas unless you lease one clock between them.

### 5.3 Evolu

Evolu's send rule is the paper's, with Jazz-style rollover and a drift check:

`evolu/packages/common/src/local-first/Timestamp.ts`, commit `f082fdd`:

```ts
export const sendTimestamp =
	(deps: TimestampConfigDep) =>
	(timestamp: Timestamp, now: Millis): Result<Timestamp, TimestampError> => {
		let millis = Math.max(now, timestamp.millis) as Millis;
		let counter = millis === timestamp.millis ? increment(timestamp.counter) : minCounter;
		if (counter > maxCounter) {
			millis = Millis.orThrow(increment(millis));
			counter = minCounter;
		}
		// ... drift check, returns TimestampDriftError with cause: "local"
	};
```

The receive rule is a notable **simplification of Figure 5** that turns out to be equivalent:

```ts
export const receiveTimestamp =
	(deps: TimestampConfigDep) =>
	(local: Timestamp, remote: Timestamp, now: Millis): Result<Timestamp, TimestampError> => {
		if (isTimestampBeyondMaxDrift(deps)(remote.millis, now)) {
			return err({ type: "TimestampDriftError", timestamp: remote, cause: "remote", now });
		}
		const latest = orderTimestamp(local, remote) >= 0 ? local : remote;
		return sendTimestamp(deps)({ ...latest, nodeId: local.nodeId }, now);
	};
```

Rather than Figure 5's four-way case analysis, it takes the lexicographic max of the two timestamps and runs the send rule on it. Check it against the cases: if `l.local = l.remote`, `latest` is whichever has the larger counter (node ID only breaks an exact `⟨millis, counter⟩` tie, where the counters are equal anyway), and `sendTimestamp` then adds 1 — the paper's `max(c.j, c.m) + 1`. If one `l` dominates, `latest` is that one and `sendTimestamp` adds 1 to its counter — the paper's `c.e + 1` / `c.m + 1`. If `now` exceeds both, `sendTimestamp` resets the counter to 0. All four Figure 5 branches, in three lines. **The drift check happens before any arithmetic**, so a rejected remote timestamp cannot drag the local clock forward — which is the whole point, and is easy to get wrong.

Evolu is also the only implementation read here that treats a future timestamp as _state_ rather than an error. Quoting its module docs:

> When a message's own timestamp exceeds the limit, Evolu stores the message in quarantine without applying it to application tables. [...] Quarantine is state, not an error. Nothing is reported through the error channel; the quarantine table records each unapplied message with its reason [...] Applications watch that table through queries [...] so the application can explain why the user's change is not visible.

Quarantine is re-evaluated at worker startup, so devices converge once their system clocks pass the quarantined timestamp. And relays deliberately do not check: "acceptance belongs to clients and must not depend on an honest relay or its system clock."

### 5.4 The ones that do not use HLC

**Automerge** is a pure Lamport clock. `rust/automerge/src/types.rs` at `0730708`:

```rust
pub(crate) struct OpId(u32, u32);
// ...
impl Ord for OpId {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.cmp(&other.0).then(self.1.cmp(&other.1))
    }
}
```

`(counter, actor_index)` — counter first, actor index as tie-break. No wall clock anywhere in the ordering. (Automerge changes carry a `time` field, but it is metadata for humans, not an input to merge.) Causality is tracked separately and exactly, by change hashes and dependency sets.

**Yjs** is similar. `src/utils/ID.js` at `4d75cc8`: `ID { client, clock }`, with `INTERNALS.md` calling it "a _ID(clientID, clock)_ pair (also known as a [Lamport Timestamp])". The `clock` is a per-client item counter, and causality comes from the state vector, not from the clock value.

Both are instructive: **a CRDT that is designed so every concurrent outcome is well-defined does not need a wall clock at all.** You need HLC precisely when your merge rule is "latest wins" and you need "latest" to mean something a human would recognise.

**ElectricSQL's** current sync service orders by Postgres LSN and `pg_snapshot` (`packages/sync-service/lib/electric/lsn_tracker.ex` and friends at `2362939`); there is no HLC in the tree. **Replicache/Zero** are server-authoritative: per-client sequential mutation IDs, a server "cookie" for the canonical version, and client-side rebase — the Replicache docs describe the client rewinding "to the last version it got from the server, appl[ying] the patch [...] and then replay[ing] any pending mutations on top." **RxDB** uses a CouchDB-style `height-hash` revision string and raises `409 CONFLICT`; its docs say revisions "work similar to Lamport Clocks" and link to Fowler's write-up (secondary).

---

## 6. Spanner is not HLC, and the difference is the whole design

Spanner's TrueTime returns an _interval_, not a point. From the TOCS paper §3:

> The `TT.now()` method returns a `TTinterval` that is guaranteed to contain the absolute time during which `TT.now()` was invoked. [...] TrueTime guarantees that for an invocation `tt = TT.now()`, `tt.earliest ≤ t_abs(e_now) ≤ tt.latest`

`ε` is half the interval width. In Google's production environment it "is typically a sawtooth function of time, varying from about 1 to 7 ms over each poll interval", with "the daemon's poll interval [...] currently 30 seconds, and the current applied drift rate [...] set at 200 microseconds/second", plus "1 ms [...] from the communication delay to the time masters." This rests on GPS receivers and atomic clocks in every datacenter.

Spanner achieves causality by **waiting**, per §4.1.2:

> **Commit Wait.** The coordinator leader ensures that clients cannot see any data committed by `T_i` until `TT.after(s_i)` is true. Commit wait ensures that `s_i` is less than the absolute commit time of `T_i`

Measured cost, §5: "From the 1-replica experiments, commit wait is about 4 ms."

The HLC paper is direct about the contrast (§1.1 and §6.3):

> If TT is used for ordering events that respect causality then it is essential that if `e hb f` then `tt.e < tt.f`. Since TT is purely based on clock synchronization of physical clocks, to satisfy this constraint, Spanner delays event `f` when necessary. Such delays and reduced concurrency are prohibitive especially under looser clock synchronization.

> HLC does not require waiting out the clock uncertainty, since it is able to record causality relations within this uncertainty interval using the HLC update rules.

But it also concedes what the wait buys, which is more than HLC gives:

> However, these "commit-waits" also enable Spanner to provide a stronger property, external consistency (a.k.a, strict serializability): if a transaction `t1` commits (in absolute time) before another transaction `t2` starts, then `t1`'s assigned commit timestamp is smaller than `t2`'s.

So:

|                              | Spanner / TrueTime                            | HLC                                |
| ---------------------------- | --------------------------------------------- | ---------------------------------- |
| Clock model                  | interval with proven bound                    | point, with a _promised_ bound `ε` |
| Hardware                     | GPS + atomic clocks                           | whatever NTP gives you             |
| Causality within uncertainty | **waits it out** (`commit wait`)              | **records it** in `c`              |
| Guarantee                    | external consistency / strict serializability | `e hb f ⇒ hlc.e < hlc.f` only      |
| Write latency cost           | ~4 ms per commit                              | zero                               |
| If the bound is violated     | correctness breaks                            | correctness breaks                 |

CockroachDB offers the Spanner trade as an opt-in: `COCKROACH_EXPERIMENTAL_LINEARIZABLE` makes writing transactions "commit-wait an additional `max_offset` after committing". `doc.go` adds, in full: "HAZARD: This mode of operation is completely untested."

For a local-first client, commit-wait is not available in any form — there is no coordinator, the device is offline half the time, and `ε` is unbounded. HLC's bounded-divergence model is the only one of the two that is even expressible.

---

## 7. Practical pitfalls

### 7.1 Counter overflow

Three answers exist in the wild, and they are genuinely different:

| Policy                             | Who                                                                                     | Consequence                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Throw**                          | `crdt-example-app`, Actual (`cNew > 65535` → `OverflowError`), this repo                | the write fails; the caller must handle it                                                  |
| **Roll into the next millisecond** | Jazz (`tick_packed`), Evolu (`sendTimestamp`), MongoDB (`_advanceComponentTimeByTicks`) | the clock moves ahead of physical time by ≥1 ms, which then counts against the drift budget |
| **Never overflow by construction** | CockroachDB (`int32` logical with nanosecond wall time)                                 | the comment says "nearly impossible to overflow" and that is believable at ns resolution    |

The paper's own bound (`c ≤ ε/d + 1`) says 16 bits is ample _for the paper's model_, where events on a node are separated by at least one physical tick. A browser does not obey that model: with a 1 ms clock tick, a single `for` loop that stamps 70 000 LWW fields overflows a 16-bit counter inside one millisecond. Rolling over is the safer default for a client; throwing is defensible only if the caller genuinely can retry. Note that rolling over and _then_ checking drift, as Evolu does, is the composition that stays safe.

### 7.2 The clock going backwards

Theorem 2 (`l ≥ pt`) makes HLC _absorb_ a backward jump: `l` simply stops moving and `c` ticks until physical time catches up. That is the good case, and it is why `doc.go` says CockroachDB HLCs "provide strict monotonicity within and across restarts on a single node."

The bad case is that the counter is then the only thing advancing, so a clock set back by a day means `c` has to cover a day's worth of events. With a 16-bit counter that is 65 535 writes before overflow. Evolu names this precisely: "Only if system time then moves back far enough does the logical clock remain ahead and subsequent local changes go to quarantine." A device with a dead clock battery booting into 1970 will produce exactly this.

CockroachDB treats a backward jump as a signal rather than something to absorb silently: a warning plus a counter past `maxOffset/10`.

### 7.3 Forward jumps and clock poisoning

This is the failure mode with no clean fix. HLC spreads `l` monotonically by construction: if any node hands you a huge `l`, you adopt it, and you can never un-adopt it. One device with its clock set to 2089 can push every replica it syncs with into 2089 permanently.

The paper anticipated it in §4.1, and the mitigation is the only one available:

> In order to contain the spread of corruptions due to bad HLC values, we have a rule to ignore out of bounds messages. We simply ignore reception of messages that cause `l` value to diverge too much from `pt`. This prevention action fires if the sender of the message is providing a clock value that is significantly higher suggesting the possibility of corrupted clock.

Plus a reset rule: "In the event of extreme clock errors by NTP or transient memory corruption, the application may reach a state where these bounds are violated. In that case, we take the physical clock as the authority, and reset `l` and `c` values to `pt` and 0 respectively." And: "If HLC fires either of these actions, it also logs the offending entries for inspection and raises an exception to notify the administrator."

§4.2 introduces a separate, looser bound for this: `Δ`, as distinct from `ε`. "While Theorem 2 and Corollaries 3 and 2 state that `l − pt` stay within `ε` [...] we set a very conservative value, `Δ`, on the `l − pt` bound. The bound `Δ` can be set to a constant factor of `ε`, and even on the order of seconds depending on the application semantics." The drift limits in the table below are all `Δ`, not `ε`.

| System             | Drift limit                                            | On violation                                            |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| Paper §4.2         | `Δ`, "even on the order of seconds"                    | ignore the message; log; alert                          |
| CockroachDB        | `max_offset` = 500 ms (default)                        | `errUntrustworthyRemoteWallTimeErr`, clock not advanced |
| Jazz               | `SKEW_TOLERANCE_MS` = 30 000                           | server rejects: `ClientClockTooFarAhead`                |
| `crdt-example-app` | `maxDrift` = 60 000                                    | `throw ClockDriftError`                                 |
| Actual Budget      | `maxDrift` = 300 000                                   | `throw ClockDriftError`                                 |
| Evolu              | `defaultTimestampMaxDrift` = 300 000, not configurable | quarantine the message, do not advance the clock        |
| MongoDB            | `maxAcceptableLogicalClockDriftSecs` = **1 year**      | `ClusterTimeFailsRateLimiter`                           |

MongoDB's one-year default looks absurd until you see that MongoDB defends the same attack a different way: `$clusterTime` is HMAC-signed and validated (`logical_time_validator.h` — "verifying signatures of signed cluster times"), so an unauthenticated client cannot advance the cluster clock at all. The rate limiter is a backstop, not the primary control. **A local-first system cannot copy this**: the clock is minted on an untrusted user device, so the signature would only prove the user signed their own wrong clock.

Evolu's docs are the only source read here that works through recovery on the _offending_ device, and the answer is sobering: because the clock never moves backwards and is shared across owners, correcting system time does not help. "Recovery there therefore starts by resetting the clock to system time with a fresh random node ID [...] The reset is never automatic, because a clock that fell back, as after a dead clock battery, looks the same, and resetting then would stamp changes in the past." The data itself needs migrating to a new owner with fresh timestamps.

### 7.4 Persistence across restarts

The clock state `⟨l, c⟩` **must** survive process restart, or the first event after a restart can reuse a timestamp already issued. Two strategies:

- **Persist the clock.** Evolu stores `⟨millis, counter, nodeId⟩` in the database; `crdt-example-app` has `serializeClock`/`deserializeClock` writing `{timestamp, merkle}` as JSON. This is what a client should do, because the alternative is not available offline.
- **Sleep it off.** CockroachDB's `ensureClockMonotonicity` waits out `MaxOffset` on boot when no persisted bound exists. Viable only when you know a bound.

Browsers add a wrinkle neither covers: the tab can be killed at any moment with no unload guarantee, so the persisted clock must be written _before_ the timestamp escapes, not after — the same ordering requirement that [`distributed-id-generation.md` §3](distributed-id-generation.md) states for sequence allocation ("An allocated range must be durable before IDs escape"). And several tabs share one origin: Jazz leases a node ID per foreground tab; Evolu runs the clock in a single leader-locked worker ("the tab holding the leader lock hosts the database worker"). Either works; sharing a clock between tabs without coordination does not.

### 7.5 Clocks in the browser

`Date.now()` is the only wall clock available to a web client, and it has four distinct problems.

1. **Resolution is 1 ms.** That is the physical granularity of the ECMAScript time value. Everything finer has to come from the counter, which is why the counter width matters more in a browser than in CockroachDB's nanosecond world.
2. **`performance.now()` is not a substitute.** It is a monotonic duration since a time origin, not an epoch time, so it cannot be compared across devices or across page loads. It is also deliberately coarsened. [HR-Time][hrtime] §4 defines a normative "coarsen time" step — "In an implementation-defined manner, coarsen and potentially jitter timestamp such that its resolution will not exceed time resolution" — and sets "time resolution [to] be 100 microseconds, or a higher implementation-defined value. If `crossOriginIsolatedCapability` is true, set time resolution to be 5 microseconds". §9.1 gives the reason: "cache attacks, statistical fingerprinting and micro-architectural attacks are a privacy and security concern", with "Resolution reduction", "Added jitter" and "Abuse detection and/or API call throttling" named as permitted mitigations. This is the Spectre-era clamping, and it means `performance.now()` cannot even be used to refine `Date.now()` below a millisecond in a non-isolated context.
3. **The user can set the clock.** This is categorically different from NTP skew. Evolu's module docs enumerate the real causes: "A person sets the clock by hand, often misreading daylight saving time or the year, or picks a wrong time zone while the clock is set manually. A virtual machine resumes from a snapshot. Time synchronization corrects a clock that ran fast. A device with a dead clock battery boots into the past." And the useful calibration: "System time is usually wrong by hours, rarely by years." A `Δ` of 500 ms is server thinking; minutes is client thinking.
4. **It is adversarial input.** Any timestamp arriving from a peer was minted by a device the user may control. Evolu's choice to have relays store and forward without checking drift — pushing the decision to each receiving client — follows directly: "acceptance belongs to clients and must not depend on an honest relay or its system clock."

One thing HLC genuinely does _not_ care about, worth saying because it comes up: daylight saving and time zones are irrelevant. Epoch milliseconds have no zone.

---

## 8. What HLC does not give you

Restating §2's table for the thing that matters:

```text
e hb f  ⇒  hlc.e < hlc.f      ✅  Theorem 1
e hb f  ⇐  hlc.e < hlc.f      ❌  does not hold
e hb f  ⇔  vc.e < vc.f        ✅  but O(nodes) space
```

Concretely: you are handed `hlc.e = ⟨100, 0, A⟩` and `hlc.f = ⟨103, 0, B⟩`. You know `f` did not happen before `e`. You do **not** know whether `e` happened before `f` or whether they were concurrent. B's clock may simply have been 3 ms ahead while the two devices were offline from each other for a week.

So:

- **Conflict resolution** — picking one deterministic winner — is what HLC is for, and it does it well, with the bonus that the winner is usually the one a human would also pick, because `l` tracks real time within `ε`.
- **Conflict detection** — "these two edits were concurrent, surface both / ask the user / fork a branch" — HLC cannot do at all. You need a version vector, a dependency set (Automerge's change hashes), or an explicit causal context.

The paper does claim one thing in the other direction, and it is weaker than it reads: `l.e = l.f ⇒ e || f` (§3.1). _Equal_ HLCs imply concurrency; _ordered_ HLCs imply nothing. That is what makes `⟨l = t, c = 0⟩` a consistent global snapshot (§6.1), using "virtual dummy events" to guarantee such an event exists on every node at every `t`, and it is the paper's headline application. It is not a conflict-detection primitive.

Three corollaries for a local-first library:

1. **Do not build "show the user both versions" on HLC alone.** Either carry a causal context alongside, or pick a CRDT whose merge is total — see [`array-like-crdts.md`](array-like-crdts.md) and [`map-object-crdts.md`](map-object-crdts.md).
2. **A newer HLC does not mean "the user saw the older value".** Read-modify-write safety needs compare-and-set against a version the client actually read, not a timestamp comparison.
3. **HLC is not an ID.** It is close — `⟨l, c, node⟩` is unique and roughly sortable, like the time-prefixed schemes in [`distributed-id-generation.md`](distributed-id-generation.md) — but a clock that can be dragged forward by a peer makes a poor primary key. Evolu's warning about a copied database minting duplicate `⟨millis, counter, nodeId⟩` triples is the concrete version of this, and it is the same "two generators, one machine identity" hazard Snowflake has.

---

## 9. This repo's `Time`, measured against the paper

`packages/time/src/Time.ts` says "Represents time using a Hybrid Logical Clock (HLC) model" and implements the send rule correctly:

`packages/time/src/Time.ts` (working tree, 2026-10-04):

```ts
	protected static tick(): void {
		const currentTime = Date.now();

		if (currentTime > GlobalTime.time) {
			GlobalTime.time = currentTime;
			GlobalTime.counter = 0;
		} else {
			if (GlobalTime.counter >= MAX_COUNTER) throw new CounterOverflowError(GlobalTime.counter + 1, MAX_COUNTER);

			GlobalTime.counter++;
		}
	}
```

That is Figure 5's "send or local event", with the counter reset on `l` advancing. The string form, `'2024-11-10T12:39:10.776Z+00002+9f1d0b07-7a3c-4d1e-9f52-6c2a4e8b1d30'`, is fixed-width ISO plus 5 hex digits plus a UUID, so it sorts lexicographically in the same order `compare` computes — the `crdt-example-app` trick, with a longer replica field.

**Resolved since this note was written: the replica tie-break.** `Time` now carries the replica that minted it and `compare` orders by physical time, then logical time, then replica, so `isAfter` is total and `LWWRegister.merge`'s branches are exhaustive. The divergence described below as gap 1 no longer occurs. [ADR-09](../../decisions/ADR-09-stamp-times-with-a-replica-identity.md) records the decision; the original finding is kept here because the remaining gaps are stated against it.

Three gaps remain against the paper and against every implementation in §5:

**0. No replica, so `isAfter` had a tie (fixed).** As first written, `isAfter` was strict and `LWWRegister.merge` did nothing when neither side was after the other:

`packages/entities/src/LWWRegister.ts`:

```ts
	merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.value = this.value;
			remote.timestamp = this.timestamp;
		} else if (remote.timestamp.isAfter(this.timestamp)) {
			// ...
		}
		return this;
	}
```

Two replicas that each wrote within the same millisecond, each on their first write after a load, both produced `⟨t, 0⟩`. Neither `isAfter` fired; both kept their own value; both believed they merged. This is the §3 divergence. The fix was the third field in the comparison that `RGA` already had at the element level — `ElementId { time, key }`, with the row key as the tie-break. Note the tie is unreachable inside one process, because the shared `GlobalTime` counter separates two stamps minted in the same millisecond; it was only ever reachable across devices.

**1. No receive rule.** There is no `Time.receive(local, remote, now)`. `RGA` compensates privately:

`packages/entities/src/RGA.ts`:

```ts
	private witness(time: Time): void {
		if (time.isAfter(this.clock)) this.clock = time;
	}
```

but that clock is per-`RGA`-instance and is not the `GlobalTime` static that `Time.now()` advances, and `LWWRegister.merge` / `LWWMap.merge` never witness anything. So for LWW values, **Theorem 1 does not hold across replicas**: a device can receive a remote write stamped `⟨500, 0⟩`, then make a causally-later local write stamped `⟨400, 7⟩` because its own clock is behind, and lose. This is precisely the lost-write scenario from §2, i.e. the thing HLC is supposed to prevent — and this repo's `LWWRegister` is currently vulnerable to it in the same way a plain wall clock would be. One `Time.receive` wired into every `merge` closes it.

**2. No drift bound.** `Time.now()` and the constructor accept any `pt`. There is no `Δ`, no rejection of a remote timestamp from the future, and therefore no containment: one device with a bad clock permanently poisons every replica it touches (§7.3). `MAX_TIME = 8_640_000_000_000_000` is the ECMAScript `Date` limit, a range check rather than a drift check.

**3. Counter overflow throws.** `COUNTER_DIGITS = 5` gives `MAX_COUNTER = 16^5 − 1 = 1 048 575` — 20 bits, four more than the paper's 16, so overflow is unlikely. But `new Time(...)` throws `CounterOverflowError` rather than rolling into the next millisecond, so if it ever does happen the write fails rather than degrading (§7.1). Since the counter is only reset by `Date.now()` advancing, a clock set back by an hour makes this reachable: 3.6 million milliseconds of backlog against a 1 048 575-tick budget.

None of this is a bug report with a prescribed fix; it is the delta between the file's docstring and the model it names.

---

## 10. What I could not verify

- The **OPODIS 2014 published version**. Springer returned an auth redirect and dblp returned an access-denied page. A web search reported pages 17–32, but that is search-result metadata from a secondary aggregator and is **not** cited above. All paper content here is the Buffalo tech report `2014-04`, and the two versions may differ editorially.
- The paper's own reference implementation at `github.com/AugmentedTimeProject` — the URL in the PDF is described as "anonymized" for review and I did not attempt to locate a successor repository.
- **`@electric-sql/experimental`** and the older ElectricSQL "satellite" architecture. The current `electric-sql/electric` tree at `2362939` contains no HLC (its ordering is Postgres LSN and `pg_snapshot`); earlier versions of that project may have, but a shallow clone cannot see them and I did not fetch the history.
- **Zero's** conflict-resolution mechanism beyond what the Replicache "how it works" page documents. Neither `zero.rocicorp.dev/docs/introduction` nor `/docs/writing-data` states an ordering rule; I did not read the Zero source.
- **Jepsen's** uncertainty-interval analysis is cited here only for the 2016 CockroachDB default of 250 ms, which the current source contradicts (500 ms). Treat the whole Jepsen report as describing a 2016 build.
- No **benchmarks** were run. The counter-distribution and `l − pt` figures in §1.5 are the paper's own measurements on 2014 AWS hardware, and the overflow arithmetic in §7.1 and §9 is a bit-width calculation, not a measurement.

---

## Primary sources

Every source-code link is pinned to the commit actually read; every spec link points at the section it supports.

- **Paper.** [Buffalo tech report 2014-04][paper] (read in full). Peer-reviewed version: [doi:10.1007/978-3-319-14472-6_2][paper-doi] (not reachable).
- **CockroachDB**, `d30c905`: [`hlc/doc.go`][crdb-doc] (the design rationale, causality channels, and the `HAZARD:` list), [`hlc/hlc.go`][crdb-hlc] (`NowAsClockTimestamp`, `Update`, `UpdateAndCheckMaxOffset`, `checkPhysicalClock`), [`hlc/timestamp.go`][crdb-ts] (`Less`, `Compare`, `String`), [`hlc/timestamp.proto`][crdb-proto] (wire format), [`uncertainty/doc.go`][crdb-uncertainty] (uncertainty intervals, observed timestamps), [`server/clock_monotonicity.go`][crdb-monotonicity] (restart handling), [`server/config.go`][crdb-config] (`toleratedOffsetMultiplier = 0.8`), [`base/constants.go`][crdb-constants] (`DefaultMaxClockOffset = 500ms`), [`rpc/clock_offset.go`][crdb-offset] (`VerifyClockOffset`, self-termination).
- **Spanner**, [TOCS 31(3) art. 8][spanner-pdf]: §3 (TrueTime API, `ε` sawtooth), §4.1.2 (commit wait), §5 (~4 ms measured).
- **Evolu**, `f082fdd`: [`local-first/Timestamp.ts`][evolu-ts] (algorithm, encoding, quarantine, duplicate-node-ID analysis), [`Time.ts`][evolu-time] (`Millis`, the 48-bit ceiling).
- **Jazz**, `71aecb6`: [`types/src/time.rs`][jazz-time] (46/18 packing, `tick_packed`, `TxTimeSortKey`), [`model/src/tx.rs`][jazz-tx] (`TxId`), [`node/ingest/commit_bundles.rs`][jazz-ingest] (`ClientClockTooFarAhead`), [`node/mod.rs`][jazz-node] (`SKEW_TOLERANCE_MS`).
- **`crdt-example-app`**, `9318b1c`: [`shared/timestamp.js`][jl-ts] (`send`, `recv`, string format), [`client/sync.js`][jl-sync] (string-comparison LWW), [`client/clock.js`][jl-clock] (clock persistence). Maintained descendant: [Actual Budget `packages/crdt/src/crdt/timestamp.ts`][actual-ts], `b490e3e`.
- **MongoDB**, `2348395`: [`logical_time.h`][mongo-logical-time], [`vector_clock/vector_clock.cpp`][mongo-vc] (`_ensurePassesRateLimiter`), [`vector_clock_mutable.cpp`][mongo-vc-mutable] (tick + second-rollover), [`vector_clock_document.idl`][mongo-vc-idl] (one-year default), [`logical_time_validator.h`][mongo-validator] (HMAC signing).
- **Not HLC, read to confirm:** [Automerge `rust/automerge/src/types.rs`][automerge-types] (`0730708`), [Yjs `src/utils/ID.js`][yjs-id] and [`INTERNALS.md`][yjs-internals] (`4d75cc8`), [ElectricSQL `lsn_tracker.ex`][electric-lsn] (`2362939`), [RxDB conflicts doc][rxdb-conflicts] (`f34569d`), [Replicache "How it works"][replicache-how].
- **Specs:** [W3C High Resolution Time][hrtime] §4 (coarsen time), §9.1 (clock resolution and timing attacks); [MDN `performance.now()`][mdn-now].
- **Secondary, flagged in-text:** [Jepsen, CockroachDB beta-20160829][jepsen]; [Kingsbury, "The trouble with timestamps"][aphyr] (the paper's own reference [8]).

[paper]: https://cse.buffalo.edu/tech-reports/2014-04.pdf
[paper-doi]: https://doi.org/10.1007/978-3-319-14472-6_2
[spanner-pdf]: https://storage.googleapis.com/gweb-research2023-media/pubtools/1974.pdf
[crdb-doc]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/util/hlc/doc.go
[crdb-hlc]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/util/hlc/hlc.go
[crdb-ts]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/util/hlc/timestamp.go
[crdb-proto]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/util/hlc/timestamp.proto
[crdb-uncertainty]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/kv/kvserver/uncertainty/doc.go
[crdb-monotonicity]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/server/clock_monotonicity.go
[crdb-config]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/server/config.go
[crdb-constants]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/base/constants.go
[crdb-offset]: https://github.com/cockroachdb/cockroach/blob/d30c905fff79ef825adc96bcc647f1872a90f2ff/pkg/rpc/clock_offset.go
[evolu-ts]: https://github.com/evoluhq/evolu/blob/f082fdd974e25fa0eb1134e4b34f15b740af8fe2/packages/common/src/local-first/Timestamp.ts
[evolu-time]: https://github.com/evoluhq/evolu/blob/f082fdd974e25fa0eb1134e4b34f15b740af8fe2/packages/common/src/Time.ts
[jazz-time]: https://github.com/garden-co/jazz/blob/71aecb6d275a1ec3dad737ccbf1c0a6a5ecdbbed/crates/jazz/layers/types/src/time.rs
[jazz-tx]: https://github.com/garden-co/jazz/blob/71aecb6d275a1ec3dad737ccbf1c0a6a5ecdbbed/crates/jazz/layers/model/src/tx.rs
[jazz-ingest]: https://github.com/garden-co/jazz/blob/71aecb6d275a1ec3dad737ccbf1c0a6a5ecdbbed/crates/jazz/layers/node/src/node/ingest/commit_bundles.rs
[jazz-node]: https://github.com/garden-co/jazz/blob/71aecb6d275a1ec3dad737ccbf1c0a6a5ecdbbed/crates/jazz/layers/node/src/node/mod.rs
[jl-ts]: https://github.com/jlongster/crdt-example-app/blob/9318b1c5e8c5893316d571b1c3a9db9359e55990/shared/timestamp.js
[jl-sync]: https://github.com/jlongster/crdt-example-app/blob/9318b1c5e8c5893316d571b1c3a9db9359e55990/client/sync.js
[jl-clock]: https://github.com/jlongster/crdt-example-app/blob/9318b1c5e8c5893316d571b1c3a9db9359e55990/client/clock.js
[actual-ts]: https://github.com/actualbudget/actual/blob/b490e3e76e43dd0920445bc1a2382afe7c99fbf8/packages/crdt/src/crdt/timestamp.ts
[mongo-logical-time]: https://github.com/mongodb/mongo/blob/23483951d618f7d87648211499cf05b2f38991ce/src/mongo/db/logical_time.h
[mongo-vc]: https://github.com/mongodb/mongo/blob/23483951d618f7d87648211499cf05b2f38991ce/src/mongo/db/topology/vector_clock/vector_clock.cpp
[mongo-vc-mutable]: https://github.com/mongodb/mongo/blob/23483951d618f7d87648211499cf05b2f38991ce/src/mongo/db/topology/vector_clock/vector_clock_mutable.cpp
[mongo-vc-idl]: https://github.com/mongodb/mongo/blob/23483951d618f7d87648211499cf05b2f38991ce/src/mongo/db/topology/vector_clock/vector_clock_document.idl
[mongo-validator]: https://github.com/mongodb/mongo/blob/23483951d618f7d87648211499cf05b2f38991ce/src/mongo/db/logical_time_validator.h
[automerge-types]: https://github.com/automerge/automerge/blob/07307081183252ed5522f1966d734d4e8329456b/rust/automerge/src/types.rs
[yjs-id]: https://github.com/yjs/yjs/blob/4d75cc8e4024dbb1f554737aa93c68b2e54adebe/src/utils/ID.js
[yjs-internals]: https://github.com/yjs/yjs/blob/4d75cc8e4024dbb1f554737aa93c68b2e54adebe/INTERNALS.md
[electric-lsn]: https://github.com/electric-sql/electric/blob/236293974902a08990ffc9ece5ab6ce58d76cd84/packages/sync-service/lib/electric/lsn_tracker.ex
[rxdb-conflicts]: https://github.com/pubkey/rxdb/blob/f34569d787d543d6ea2cb7799a1dfd7520b3aa27/docs-src/docs/transactions-conflicts-revisions.md
[replicache-how]: https://doc.replicache.dev/concepts/how-it-works
[hrtime]: https://w3c.github.io/hr-time/
[mdn-now]: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
[jepsen]: https://jepsen.io/analyses/cockroachdb-beta-20160829
[aphyr]: https://aphyr.com/posts/299-the-trouble-with-timestamps
