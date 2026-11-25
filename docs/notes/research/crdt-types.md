# CRDT types

Research date: **2026-11-24** (papers in `docs/papers/`, two papers from outside that collection, and this repository's working tree).
Scope: a catalogue of the main CRDT types (registers, counters, sets, maps and sequences) and the state-based, op-based and delta-state styles they are written in. For each type: the state it keeps, its operations, how merge or apply works, what happens under concurrency, what metadata it carries, and where it fits. This is the overview. Companions in this directory go deeper and are linked instead of repeated: [Implementing RGA](rga-implementation.md), [Map- and object-like CRDTs](map-object-crdts.md), [Array-like CRDTs](array-like-crdts.md), [CRDT deltas](crdt-deltas.md), [Hybrid Logical Clocks](hybrid-logical-clocks.md) and [Persisting CRDT metadata](crdt-metadata-persistence.md).

**Papers in `docs/papers/`:**

- M. Shapiro, N. Preguiça, C. Baquero, M. Zawirski, "Conflict-free Replicated Data Types", SSS 2011 ([`docs/papers/`][sss]). The local file is the HAL preprint (hal-00932836). Page numbers below are the preprint's printed numbers, 1–15. This is the short conference paper: it defines CvRDT and CmRDT and specifies counters, the U-Set, a log and a graph, but **not** registers, the other sets or sequences.
- H.-G. Roh, M. Jeon, J.-S. Kim, J. Lee, "Replicated abstract data types: Building blocks for collaborative applications", _J. Parallel Distrib. Comput._ 71 (2011) 354–368 ([`docs/papers/`][roh]). Page numbers are the journal's. Read for RFA, RHT and RGA.
- P. Nicolaescu, K. Jahns, M. Derntl, R. Klamma, "Near Real-Time Peer-to-Peer Shared Editing on Extensible Data Types", GROUP 2016 ([`docs/papers/`][yata]). The authors' preprint has no printed page numbers, so citations give the section and the PDF page.
- M. Kleppmann, A. Wiggins, P. van Hardenberg, M. McGranaghan, "Local-First Software: You Own Your Data, in Spite of the Cloud", Onward! 2019 ([`docs/papers/`][lfs]). Practical context only. Page numbers are the proceedings'.
- M. Kleppmann, _Designing Data-Intensive Applications_ ([`docs/papers/`][ddia]). Practical context only. Page numbers are the book's.

**Outside the local collection, flagged:**

- M. Shapiro, N. Preguiça, C. Baquero, M. Zawirski, "A comprehensive study of Convergent and Commutative Replicated Data Types", INRIA RR-7506, January 2011 ([HAL record][rr-hal]). HAL serves a bot challenge, so I read the HAL-generated PDF (metadata `Creator: HAL`, 51 pages) from the same [course mirror][rr] the RGA note used. Page numbers are the report's. This is the catalogue the conference paper points to for "a comprehensive portfolio of CRDT designs" ([SSS §1, p. 2][sss]), and the only source here that specifies the LWW-Register, MV-Register, 2P-Set, LWW-element-Set and OR-Set.
- P. S. Almeida, A. Shoker, C. Baquero, "Delta State Replicated Data Types", arXiv [1603.01529**v1**][delta]. Cited by section and figure. Used for delta-state framing, dot-based registers and sets, and the map that embeds CRDTs.

**Repository** (working tree of `main` at `27009b10`, which includes uncommitted changes to `rga.ts`): [`lww-register.ts`][nn-lww], [`lww-map.ts`][nn-lww-map], [`rga.ts`][nn-rga], [`time.ts`][nn-time], [`create-strategy.ts`][nn-strategy].

Section 10 lists what I could **not** verify.

---

## Short answer

1. **There are two ways to specify a CRDT, and they are equivalent in power.** A state-based CRDT (CvRDT) keeps its states in a join-semilattice, updates only move up, and merge is the least upper bound, so any gossip that eventually delivers states converges ([SSS Def. 4, Thm. 1, p. 5][sss]). An op-based CRDT (CmRDT) splits each update into a source-side prepare and a downstream effect, needs reliable causal broadcast, and converges if concurrent effects commute ([SSS Def. 6, Thm. 2, pp. 5–6][sss]). Each can emulate the other ([SSS §3.2, pp. 7–8][sss]). A delta-state CRDT is state-based but ships small states produced by delta-mutators, joined like any other state ([Almeida Defs. 1–3, §4][delta]).
2. **Every type is a decision about concurrent operations.** Add and remove on a set do not commute, so "a Set cannot both be a CRDT and conform to the sequential specification of a set" ([RR §3.3, p. 21][rr]). The types below differ mostly in which concurrent operation wins: the later timestamp (LWW), the add (OR-Set, add-wins), the remove (2P-Set, remove-wins), or neither (MV-Register keeps both).
3. **Registers:** the **LWW-Register** stores `(value, timestamp)` and merge keeps the greater timestamp. Timestamps must be unique, totally ordered and consistent with causality ([RR §3.2.1, p. 19][rr]). It silently drops concurrent writes ([DDIA p. 186][ddia]). The **MV-Register** keeps every value whose version vector is not dominated, so concurrent writes all survive until a later write overwrites them ([RR Spec. 10, §3.2.2, p. 20][rr]).
4. **Counters and sets:** the **G-Counter** is a vector with one entry per replica, merged by pointwise max; the **PN-Counter** is two of them ([RR Specs. 6–7, pp. 15–16][rr]). The **G-Set** only grows; the **2P-Set** adds a tombstone set and never re-adds; the **LWW-element-Set** timestamps every add and remove; the **OR-Set** tags each add uniquely and removes only the tags it observed, so a concurrent add wins ([RR §§3.3.1–3.3.5, pp. 21–27][rr]).
5. **"Map" names at least three different things.** An **LWW map** is one LWW register per key, with deletion as a timestamped tombstone, so set and delete are decided by timestamp (Roh's RHT, [Roh §5.3, pp. 360–361][roh]). An **OR-Map** gives keys observed-remove semantics: RR-7506 derives a shopping-cart map from the OR-Set ([RR §5.1, Spec. 21, pp. 39–40][rr]), and Almeida et al. build a map that embeds any causal CRDT under one shared causal context, where removing a key resets the child's observed state ([Almeida §7.4, Fig. 17][delta]). A **record** of fixed fields is just a product of CRDTs ([Almeida §7.1, Fig. 3][delta]). This repository's `LWWMap` is the third kind (§9).
6. **RGA** is the sequence type: a linked list of elements with unique, causality-consistent timestamps. An insert names the element it goes after, skips following elements with greater timestamps, and splices in. A delete leaves a tombstone so concurrent inserts can still find their anchor ([RR Spec. 19, §3.5.1, pp. 34–35][rr]; [Roh §5.5, p. 362][roh]). Other sequence designs place elements in a dense identifier space (Treedoc, Logoot, [RR §3.5.2, pp. 35–37][rr]), keep a partial order (WOOT, [RR §3.5, p. 33][rr]), or use left and right insertion origins (YATA, [YATA §3.2, PDF p. 4][yata]).
7. **The metadata is the price.** LWW types keep a timestamp per value and a tombstone per deletion; counters keep an entry per replica; OR-Set and OR-Map keep unique tags or a causal context; sequences keep tombstones or long identifiers. Collecting any of it safely needs to know that every replica has seen the operation, which needs a known replica set ([RR §4.1, p. 38][rr]). Some resets need a commitment protocol ([RR §4.2, p. 39][rr]).

---

## 1. Framing: how CRDTs are specified

### 1.1 Strong eventual consistency

Eventual consistency asks that replicas which have delivered the same updates _eventually_ reach equivalent states. Strong eventual consistency (SEC) drops "eventually": "Correct replicas that have delivered the same updates have equivalent state" ([SSS Defs. 2–3, p. 4][sss]). The point is to avoid executing an update, discovering a conflict, and rolling back, which "in general requires a consensus" ([SSS §2.2, p. 4][sss]). A CRDT is a type that satisfies one of the two sufficient conditions below.

### 1.2 State-based (CvRDT)

An object is `(S, s0, q, u, m)`: states, initial state, query, update, merge. Replicas occasionally send their whole state and the receiver runs `m` ([SSS §2.1, p. 3][sss]). If the states form a join-semilattice, merge computes the least upper bound, and every update is an inflation (`s ≤ s • u`), the object is SEC given eventual delivery ([SSS Def. 4, Thm. 1, p. 5][sss]). The LUB is commutative, idempotent and associative, so "messages may be lost, received out of order, or multiple times" ([RR §2.3.1, p. 10][rr]).

```text
merge(x, y) = x ⊔ y          // commutative, associative, idempotent
s ≤ update(s)                // updates only move up the lattice
```

### 1.3 Op-based (CmRDT)

An op-based object has no merge. Each update is a pair: a side-effect-free _prepare_ that runs at the source, and an _effect_ that runs at every replica ([SSS §2.4, p. 5][sss]). RR-7506 calls them `atSource` and `downstream` ([RR Spec. 2, p. 8][rr]). Delivery is reliable causal broadcast, so causally related effects run in the same order everywhere and only concurrent ones need to commute ([SSS §2.4, pp. 5–6, Def. 6, Thm. 2][sss]). A downstream precondition can delay an effect, for example "remove only after the matching add has been delivered" ([SSS §2.4, p. 6][sss]; [RR §2.3.2, p. 11][rr]).

### 1.4 The two are equivalent, the costs are not

A state-based object can be emulated op-based by shipping the post-update state as the operation and merging it downstream. An op-based object can be emulated state-based by keeping a grow-only set of known operations and delivering the ready ones, which "formalises the mechanics of an epidemic reliable causal broadcast" ([SSS Thms. 3–4, §3.2, pp. 7–8][sss]; [RR Specs. 3–4, pp. 12–13][rr]).

| Style       | Payload                                     | Channel                                                      | Main cost                               |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| State-based | Everything needed to merge                  | Weak: loss, reordering, duplication; unknown replica count   | Shipping whole states for large objects |
| Op-based    | Can be smaller; some state lives in transit | Reliable broadcast in delivery order, which needs membership | Exactly-once, causally ordered delivery |

Source: [RR §2.4, pp. 11–12][rr]. The report adds that shipping deltas fixes the state-based cost "but this requires mechanisms similar to the op-based approach" ([RR §2.4, p. 11][rr]).

### 1.5 Delta-state

A delta-mutator "takes a state X in a join-semilattice S as parameter and returns a delta-mutation mδ(X), also in S" ([Almeida Def. 1][delta]). Every transition, local or remote, is a join: `X' = X ⊔ mδ(X)` or `X' = X ⊔ D` ([Almeida Def. 3][delta]). A delta is an ordinary state, so it can be joined repeatedly and out of order. If only convergence is wanted, deltas can go over "an unreliable dissemination layer that may drop, reorder, or duplicate messages" ([Almeida §4][delta]). Causal consistency needs more: an anti-entropy algorithm with per-neighbour acknowledgements. [CRDT deltas §6](crdt-deltas.md) covers that algorithm and why neither Automerge nor Yjs is a delta-state CRDT.

The delta form of the G-Counter shows the idea: the mutator returns only the incremented entry, `{i ↦ m(i) + 1}`, instead of the whole vector ([Almeida §4.2, Fig. 2][delta]).

### 1.6 Two composition tools used below

- **Product (pair):** the join is component-wise ([Almeida §7.1, Fig. 3][delta]). A fixed record of independent CRDTs is a product.
- **Lexicographic pair:** the first component decides; the second is joined only on a tie ([Almeida §7.1, Fig. 4][delta]). With a timestamp as the first component this is the LWW pattern.

## 2. Registers

A register "is a memory cell storing an opaque atom or object". It supports `assign` and `value`. Concurrent assigns do not commute, and "two major approaches are that one takes precedence over the other (LWW-Register), or that both are retained (MV-Register)" ([RR §3.2, p. 17][rr]).

### 2.1 LWW-Register

- **State:** a value and a timestamp, initially `(⊥, 0)` ([RR Spec. 8, p. 17][rr]).
- **Operations:** `assign(w)` sets `x, t := w, now()`; `value()` returns `x`.
- **Merge (state-based):**

  ```text
  merge(R, R'):
    if R.t ≤ R'.t then (R'.x, R'.t) else (R.x, R.t)
  ```

  ([RR Spec. 8, p. 17][rr]). The op-based version sends `(x', t')` and applies it downstream only `if t < t'` ([RR Spec. 9, p. 18][rr]).

- **Timestamps:** "assumed unique, totally ordered, and consistent with causal order". A per-replica counter concatenated with a unique replica id is enough ([RR §3.2.1, p. 19][rr]). Consistency with causality is what keeps sequential semantics: a write made after seeing another must win over it.
- **Conflict semantics:** one concurrent write wins and the others are gone. LWW "ensures a total order of operations (without consensus) but this order is arbitrary and some updates are inherently lost" ([RR §6.2, p. 42][rr]). Kleppmann puts the cost as durability: writes reported as successful "will be silently discarded" ([DDIA p. 186][ddia]). With physical-clock timestamps it can also drop writes that were _not_ concurrent, when a causally later write gets an earlier timestamp from a lagging clock ([DDIA pp. 291–292][ddia]). Causality-consistent clocks, such as the hybrid logical clocks in [this note](hybrid-logical-clocks.md), avoid that second failure, not the first.
- **Metadata:** one timestamp per register.
- **History and relatives:** Thomas's rule, used by Johnson and Thomas in a database of registers that "can be created, updated and deleted" ([RR §6.2, p. 42][rr]). Roh's **RFA** (replicated fixed-size array) is an array of LWW registers: a remote `Write` replaces the element only if its s4vector succeeds the element's last one ([Roh §5.2, Alg. 5, p. 360][roh]). The authors note that RFAs behave like Thomas's rule and that "Lamport clocks can be used in RADTs on behalf of sum of s4vectors" ([Roh §6, p. 364][roh]). The **LWW-Set** of RR-7506 is an LWW-Register whose value is a whole set, so concurrent edits to one set are not merged ([RR Fig. 8, p. 18][rr]).
- **Where it fits:** single fields where losing a concurrent write is acceptable, and keys written once and then treated as immutable. Kleppmann's advice for LWW databases is to write each key only once ([DDIA p. 186][ddia]).

### 2.2 MV-Register

- **State:** a set of `(value, versionVector)` pairs, initially `{(⊥, [0, …, 0])}` ([RR Spec. 10, p. 20][rr]).
- **Operations:** `assign(R)` computes a version vector that dominates every vector in the state (its own entry incremented) and replaces the payload with `R × {V}`; `value()` returns the whole set.
- **Merge:**

  ```text
  merge(A, B):
    A' = {(x, V) ∈ A | ∀(y, W) ∈ B : V ∥ W ∨ V ≥ W}
    B' = {(y, W) ∈ B | ∀(x, V) ∈ A : W ∥ V ∨ W ≥ V}
    return A' ∪ B'
  ```

  ([RR Spec. 10, p. 20][rr]). A scalar timestamp cannot detect concurrency, which is why the payload carries version vectors ([RR §3.2.2, p. 20][rr]).

- **Conflict semantics:** concurrent assignments all survive; a later assignment that has seen them replaces them. "Clients can later reduce multiple values to a single one, by a new assignment" ([RR §3.2.2, p. 20][rr]).
- **Not a set:** the payload is a set, but the type does not behave like one. Using it for a shopping cart reproduces Dynamo's anomaly in which a removed item reappears ([RR §3.2.2, Fig. 10, pp. 19–20][rr]; [DDIA pp. 190–191][ddia]).
- **Metadata:** a version vector per retained value in the RR-7506 design. Almeida et al. give a version that tags each value with a single dot and keeps a causal context instead: `write` maps a new dot to the value and puts all current dots in the context, so they are dropped on join ([Almeida §7.4, Fig. 14][delta]).
- **Where it fits:** fields where a wrong automatic choice is worse than showing the conflict. The local-first paper describes this behaviour in Automerge: when users "concurrently update the same property of the same object", the CRDT "keeps track of the conflicting values, and leaves it to be resolved by the application or the user" ([LFS §4.1, p. 168][lfs]). See [Map- and object-like CRDTs §3](map-object-crdts.md) for how libraries expose it.

## 3. Counters

The intended semantics is that the value converges to the number of increments minus the number of decrements ([RR §3.1, p. 14][rr]).

### 3.1 Op-based counter

The payload is one integer; `increment` and `decrement` add or subtract downstream with no precondition. Addition commutes, "assuming no overflow", so it is a CmRDT ([RR Spec. 5, p. 13; §3.1.1, p. 14][rr]). It relies on exactly-once delivery.

### 3.2 G-Counter (state-based, increment-only)

Two obvious state-based designs fail. A single integer merged by `max` converges to 1 after two concurrent increments, not 2. A single integer merged by `+` is not idempotent ([RR §3.1.2, pp. 14–16][rr]).

```text
payload  P: integer[n]                  // one entry per replica
increment():  P[myID()] += 1
value():      Σ P[i]
merge(X, Y):  Z.P[i] = max(X.P[i], Y.P[i])  for every i
```

([RR Spec. 6, p. 15][rr]). It assumes no overflow and that "the set of replicas is well-known". The op-based counter makes the same assumptions implicitly ([RR §3.1.2, p. 16][rr]). Almeida et al. write the payload as a map from replica id to count, where a missing key reads as zero ([Almeida §4.2, Fig. 2][delta]), which lets new replicas appear. The SSS paper observes that if each replica only increments its own entry, the same vector is a vector clock ([SSS §4.1, p. 9][sss]).

### 3.3 PN-Counter

Two G-Counters, `P` for increments and `N` for decrements; `value = ΣP − ΣN`; merge is pointwise max on both ([RR Spec. 7, p. 15; §3.1.3, p. 16][rr]; [SSS §4.1, p. 9][sss]). Decrement cannot be a plain subtraction from a G-Counter because it would break monotonicity, and `max` would ignore it ([RR §3.1.3, p. 16][rr]).

### 3.4 Non-negative counter

A counter that never goes below zero is a global invariant. Two replicas at 1 can each decrement and converge to −1. Hiding negative values breaks increments, and a local rule "a client may not originate more decrements than it originated increments" works but may be too strong. Otherwise the report concludes: "Sadly, the remaining alternative is to synchronise", for example with escrow ([RR §3.1.4, pp. 16–17][rr]).

### 3.5 Costs and fit

One integer per replica that ever incremented (two for PN). Removing an entry for a departed replica is a "commitment problem" that needs unanimous agreement ([RR §4.2, p. 39][rr]). Fit: likes, view counts, quotas that may be exceeded briefly. Not for balances that must stay non-negative.

## 4. Sets

Add and remove do not commute. RR-7506 shows a naive op-based set where two replicas apply the same operations in causal order and still diverge ([RR §3.3, Fig. 11, p. 21][rr]). So set CRDTs "differ mainly by the result of concurrent add(e) ∥ remove(e)" ([RR §3.3, p. 21][rr]). The SSS paper lists the options: the add wins, the remove wins, some arbitrary rule wins, or the state resets, and "any of them may be reasonable for some application" ([SSS §3.3, p. 8][sss]).

### 4.1 G-Set

The payload is a set; `add` is union; merge is union ([RR Spec. 11, p. 22][rr]). It needs no metadata and is the building block for the others. A G-Set of unique tokens can also serve as an increment-only counter when the replica set is unknown ([RR §3.1.2, p. 16][rr]).

### 4.2 2P-Set and U-Set

```text
payload  A, R                  // added, removed (the tombstone set)
lookup(e):  e ∈ A ∧ e ∉ R
add(e):     A := A ∪ {e}
remove(e):  pre lookup(e);  R := R ∪ {e}
merge:      A := A ∪ A',  R := R ∪ R'
```

([RR Spec. 12, p. 22][rr]). An element can be added and removed once, "but never added again thereafter" ([RR §3.3.2, p. 22][rr]). The remove wins. The tombstone is required so that a remove that reaches a replica before its add still takes effect ([RR §3.3.2, p. 23][rr]). Wuu and Bernstein's version is the same pair of add-only sets, with the assumption that every element is unique and added once ([SSS §4.2, p. 9][sss]).

The **U-Set** drops the tombstone set under two assumptions: elements are unique, and causal delivery ensures `add(e)` arrives before `remove(e)`. Then remove is a plain set-minus ([RR Spec. 13, §3.3.2, p. 23][rr]).

### 4.3 LWW-element-Set

Each add and each remove inserts `(e, now())` into an add-set `A` or a remove-set `R`; merge unions both; `e` is present if some add of `e` has no remove with a higher timestamp ([RR §3.3.3, Fig. 12, p. 24][rr]). Almeida et al. specify the same idea as a map from element to a lexicographic pair `(timestamp, Boolean)`, where a tie in timestamp goes to the add (`False < True`). Swapping the tie-break gives a remove-wins variant, and "it is up to the client to ensure that supplied timestamps always grow monotonically" ([Almeida §7.2, Fig. 7][delta]). Elements can be re-added. The cost is a timestamp per element and a record per removed element.

### 4.4 PN-Set

A counter per element, present when positive. Two concurrent removes take the count to −1, and a later add leaves the element absent. The report treats this as strange but convergent, and a variant that adds `|k| + 1` has other anomalies ([RR §3.3.4, Spec. 14, Fig. 13, pp. 24–26][rr]). Listed for completeness; it is not a good default.

### 4.5 OR-Set (observed-remove, add-wins)

```text
payload  S: set of (element, unique tag)
lookup(e):  ∃u : (e, u) ∈ S
add(e):
  atSource:   α := unique()
  downstream: S := S ∪ {(e, α)}
remove(e):
  atSource:   pre lookup(e);  R := {(e, u) ∈ S}
  downstream: pre every add in R delivered;  S := S \ R
```

([RR Spec. 15, p. 26][rr]). A remove deletes only the tags its source had observed. A concurrent add generates a tag the remove could not see, so "add has precedence" ([RR §3.3.5, pp. 26–27][rr]). Unlike the 2P-Set, a sequence of adds and removes on one replica behaves like a sequential set, and elements can be re-added. The SSS paper's graph uses the same construction and notes that because removes are delivered after their adds, "a set need not keep tombstones" in the op-based form ([SSS §5.3, p. 12][sss]).

RR-7506 leaves the state-based OR-Set "as an exercise" ([RR §3.3.5, p. 27][rr]). Almeida et al.'s **add-wins set** is that state-based form. Each add creates a dot `(replica, counter)`; the state is a map from element to its set of dots, plus a causal context that records every dot the replica has seen:

```text
add(e):     ({e ↦ {d}},  {d} ∪ m(e))        where d = next dot
remove(e):  ({},         m(e))
join of dot sets:
  (s, c) ⊔ (s', c') = ((s ∩ s') ∪ (s \ c') ∪ (s' \ c),  c ∪ c')
```

([Almeida §7.4, Figs. 12, 15][delta]). A dot that is in the context but not in the store "was present … but has been removed meanwhile", which "avoid[s] the need for individual tombstones" ([Almeida §7.4][delta]). Under causal anti-entropy the context compresses to a version vector ([Almeida §7.4, "Causal Context Compression"][delta]). The dual **remove-wins set** keeps, per element, dots tagged `True` (add) or `False` (remove) and hides an element if any `False` dot survives ([Almeida §7.4, Fig. 16][delta]).

### 4.6 Sets at a glance

| Type            | Concurrent add vs remove    | Re-add after remove | Metadata                                 |
| --------------- | --------------------------- | ------------------- | ---------------------------------------- |
| G-Set           | No remove                   | n/a                 | None                                     |
| 2P-Set          | Remove wins                 | Never               | Tombstone per removed element            |
| U-Set           | Cannot happen (unique adds) | n/a                 | None, given causal delivery              |
| LWW-element-Set | Greater timestamp wins      | Yes                 | Timestamp per add and per remove         |
| OR-Set (op)     | Add wins                    | Yes                 | Unique tag per live add; causal delivery |
| Add-wins set    | Add wins                    | Yes                 | Dot per live add plus a causal context   |
| Remove-wins set | Remove wins                 | Yes                 | Dots per element plus a causal context   |

Sources: [RR §§3.3.1–3.3.5, pp. 21–27][rr]; [Almeida §§7.2, 7.4][delta].

## 5. Maps

A map has to answer two questions: which keys exist, and how concurrent values under one key combine ([Map- and object-like CRDTs §2](map-object-crdts.md)). RR-7506 says "Containers, Maps, and Graphs are all based on Sets" and that "any of the Set abstractions presented earlier extends readily to a Map" ([RR §3.3, p. 21; §5.1, p. 40][rr]). So each set type above has a map counterpart, and the choice of set fixes the key semantics.

### 5.1 LWW map: a register per key, deletion as a timestamped write

Roh's **RHT** (replicated hash table) is the concrete version in the local papers. A slot holds `obj`, `s_p` (the s4vector of the last operation on it) and the key ([Roh §5.3, p. 360][roh]).

```text
remote Put(k, o):
  s := slot(k)
  if s exists and s_O ≺ s.s_p: ignore              // older than the last write or remove
  if s is a tombstone: withdraw s from Cemetery    // a newer Put revives the key
  if s missing: create slot for k
  s.obj := o;  s.s_p := s_O

remote Remove(k):
  s := slot(k)                                     // must exist; causal delivery guarantees it
  if s_O ≺ s.s_p: ignore
  s.obj := nil;  s.s_p := s_O                      // tombstone, enrolled in Cemetery
```

([Roh Algs. 6–7, pp. 360–361][roh]). Without the tombstone and the comparison, an RHT diverges: with `Remove(k1)` concurrent with two `Put(k1, …)`, two sites end with a tombstone and the third with `o2` ([Roh §2.3, p. 356][roh]).

- **Conflict semantics:** put and remove are both writes to the slot, and the later s4vector wins. Neither kind of operation always wins. Concurrent puts are LWW. A removed key can come back with a newer put.
- **Metadata:** a timestamp per key, and a tombstone per removed key until it is safe to purge. Roh uses Golding's condition, which keeps a tombstone while operations concurrent with its remove can still arrive ([Roh §5.6, p. 363][roh]).
- **Relatives:** Johnson and Thomas's LWW database of registers, where "a removed element can be recreated when necessary" ([RR §6.2, p. 42][rr]). YATA's **Map Manager** assigns each key a Replace Manager, a list whose first insertion is the current value; on concurrent replaces "either 1 or 2 will replace the old number 0", decided by YATA's insertion order ([YATA §§4.2–4.3, PDF pp. 7–8][yata]). That makes it a single-winner map per key, with the winner chosen by list order instead of a timestamp comparison.

### 5.2 OR-Map: observed-remove keys

RR-7506's shopping cart extends the OR-Set "as it minimises anomalies". The payload is a set of `(key, value, tag)` triples ([RR §5.1, Spec. 21, pp. 39–40][rr]):

```text
get(k):       Σ {n | (k, n, u) ∈ S}, or 0 if none
add(k, n):
  atSource:   α := unique();  R := {(k, n', u') ∈ S}
  downstream: S := (S \ R) ∪ {(k, n, α)}
remove(k):
  atSource:   R := {(k, n', u') ∈ S}
  downstream: S := S \ R
```

A remove deletes only the triples it observed, so "a remove concurrent with an add will cancel the products already in the cart, but not those just added" ([RR §5.2, p. 41][rr]). Concurrent adds for the same key both survive, and `get` sums them. (The report's prose and its specification disagree on whether `add` replaces observed triples; see §10.) The report adds a **U-Map**, derived from the U-Set, for maps whose keys are unique and only created and deleted once ([RR §5.2, p. 40][rr]). Wuu and Bernstein's Dictionary is "a Map CmRDT, similar to our U-Set" ([RR §6.2, p. 42][rr]).

### 5.3 Map of CRDTs: embedding with a shared causal context

Almeida et al. define a map whose values are themselves causal CRDTs, including maps ([Almeida §7.4, Fig. 17][delta]):

```text
ORMap⟨K, V⟩ = Causal⟨DotMap⟨K, V⟩⟩            // one causal context for the whole map
apply(o, k, (m, c)):  ({k ↦ v}, c')  where (v, c') = o((m(k), c))
remove(k, (m, c)):    ({}, dots(m(k)))
clear((m, c)):        ({}, dots(m))
```

- **No create operation.** Every key starts at the child type's bottom state; applying a child operation at a missing key creates it.
- **Remove is an observed reset.** Removing a key puts every dot of the child into the context. On join, those dots are dropped from other replicas, but dots they created concurrently survive. The paper describes remove as "an 'undo' of all operations leading to the embedded value" ([Almeida §7.4][delta]).
- **One context, never reset.** Giving each child its own context would let an old copy of a recreated key look newer than the new one, "since the causal contexts of the re-created entries would start again at their bottom state" ([Almeida §7.4][delta]).

Worked from Figs. 12, 15 and 17 (my derivation, not an example from the paper): a map of add-wins sets holds `bob ↦ {janet}`. Replica A removes `bob`, which adds janet's dot to A's context. Replica B concurrently adds `erik` to `bob`'s set with a new dot. On join, janet's dot is dropped because A's context contains it, and erik's dot survives because A never saw it. The result is `bob ↦ {erik}`. [Map- and object-like CRDTs §3](map-object-crdts.md) shows the same outcome in rust-crdt's and Riak's reset-remove maps.

The embedded type must be a causal CRDT that cooperates with the shared context. A plain counter does not qualify automatically; the companion note discusses Riak's counter exception ([Map- and object-like CRDTs §§3, 6](map-object-crdts.md)).

### 5.4 Fixed records

A record whose fields never come and go needs no key-level policy. It is a product of CRDTs with a component-wise join ([Almeida §7.1, Fig. 3][delta]). Roh's RFA is the array form: a fixed number of slots, each an LWW register ([Roh §§2.3, 5.2, pp. 356, 360][roh]).

### 5.5 How an LWW map differs from an OR-Map

Start from `{k: 1}`; replica A removes `k` while replica B concurrently sets `k` to 2.

| Map                                   | Outcome                                                             | Why                                                                          |
| ------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| LWW map (RHT)                         | Depends on which operation has the greater timestamp                | Put and remove are both writes to the slot ([Roh Algs. 6–7][roh])            |
| OR-Map with register values (OR-Cart) | `k` present with 2                                                  | The remove only deletes the triple it observed ([RR Spec. 21][rr])           |
| ORMap of causal CRDTs                 | `k` present with B's contribution only; A's observed state is reset | The remove adds only observed dots to the context ([Almeida Fig. 17][delta]) |
| Fixed record                          | No key removal                                                      | Fields are permanent ([Almeida Fig. 3][delta])                               |

The OR-Cart and ORMap rows are what the specifications imply for this history, worked by hand. Two further differences follow from the specifications. An LWW map stores one value per key and resolves concurrent puts by timestamp; an OR-Map keeps every concurrent addition and leaves combining them to the value type (summing in OR-Cart, the child's own join in the ORMap). And an LWW map needs a timestamped tombstone per removed key, while the causal ORMap needs no per-key tombstone, only the shared context ([Almeida §7.4][delta]).

The name "LWW-Map" is used loosely. [Map- and object-like CRDTs §2](map-object-crdts.md) reports that Akka's `LWWMap` is an observed-remove map whose values are LWW registers, which is a different thing from the per-key-register map above. I did not check Akka for this note.

## 6. Sequences

Index-based operations do not commute. Roh's example: on `[o1 o2]`, two concurrent `Insert(1, …)` give `[o1 oz oy o2]` on one site and `[o1 oy oz o2]` on another, and a concurrent `Update(2, ox)` can hit a different element on each site ([Roh §2.3, pp. 356–357][roh]). RR-7506 defines a sequence as "a totally-ordered set of elements, each composed of a unique identifier and an atom", with operations to add an element at a position and to remove one ([RR §3.5, p. 33][rr]).

### 6.1 RGA (Replicated Growable Array)

- **State:** a linked list of vertices `(atom, timestamp)`, kept as a 2P-Set of vertices plus an edge set, between sentinels `⊢` and `⊣`. "Timestamps are unique, positive, and increase consistently with causality" ([RR Spec. 19, p. 34][rr]). Roh's concrete layout adds a hash table from id to node, which makes remote operations O(1) to locate ([Roh §5.4, p. 361][roh]).
- **Operations:** `addRight(u, a)` inserts atom `a` right after the live vertex `u`; `remove(w)`. Roh's version also has `Update`. A local insert at index _i_ is rewritten as "insert after the element with id _x_" before it is broadcast ([Roh §5.4, p. 361][roh]).
- **Apply:**

  ```text
  downstream addRight(u, w = (a, t)):
    pre u ∈ VA                              // the anchor exists, tombstone or not
    l, r := u, successor(u)
    while t < timestamp(r):                 // skip successors with greater timestamps
      l, r := r, successor(r)
    splice w between l and r

  downstream remove(w):
    pre addRight(_, w) delivered
    VR := VR ∪ {w}                          // tombstone
  ```

  ([RR Spec. 19, p. 34][rr]; [Roh Alg. 8, p. 362][roh]).

- **Conflict semantics:** concurrent inserts after the same element end up "in opposite order of their timestamps" ([RR §3.5.1, p. 35][rr]). In Roh's version a delete always succeeds and "tombstones never revive", a delete beats a concurrent update, and concurrent updates are LWW by s4vector ([Roh §5.5, pp. 362–363][roh]).
- **Metadata:** a timestamp per element and a tombstone per deletion. Purging a tombstone needs every site to have seen the delete and a guarantee about its right neighbour ([Roh §5.6, p. 363][roh]).
- **Where it fits:** ordered lists and text where forward-typed runs matter more than prepend-heavy patterns. [Implementing RGA](rga-implementation.md) covers the tree view, the interleaving anomalies, ids, state-based and delta forms, and production layouts.

### 6.2 Other sequence designs, for contrast

| Design     | How order is decided                                                                                                                                                                                          | Deletion and metadata                                                                          | Source                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| WOOT       | Partial order of elements with previous and next references, linearised deterministically                                                                                                                     | Tombstones                                                                                     | [RR §3.5, p. 33][rr]; [YATA §2, PDF p. 3][yata]                                            |
| Treedoc    | Position in a binary identifier tree; sequential adds from one source grouped compactly                                                                                                                       | Tombstones; the tree becomes unbalanced over time, and rebalancing needs commitment            | [RR §3.5.2, p. 37; §4.2, p. 39][rr]                                                        |
| Logoot     | Dense identifiers, always allocated to the right; sort by identifier                                                                                                                                          | Identifiers grow; YATA's authors say it "does not require tombstones"                          | [RR §3.5.2, p. 37][rr]; [YATA §2, PDF p. 3][yata]                                          |
| LSEQ       | Logoot-style identifiers with adaptive allocation                                                                                                                                                             | Identifier growth                                                                              | [Array-like CRDTs §3](array-like-crdts.md)                                                 |
| YATA (Yjs) | Doubly linked list; each insertion keeps its creation-time `origin` and its `left`/`right`; three rules give a total order on conflicting insertions, with a smaller creator id going left on a shared origin | Tombstones, collected after a fixed time `t`; a site offline longer than `t` breaks the scheme | [YATA §§3.1–3.5, PDF pp. 3–6][yata]                                                        |
| Fugue      | Tree with left and right children; designed to minimise interleaving                                                                                                                                          | Retained ordering structure                                                                    | [Array-like CRDTs §3](array-like-crdts.md); [Implementing RGA §3.3](rga-implementation.md) |

RR-7506 specifies the dense-identifier family abstractly as a U-Set of `(atom, identifier)` pairs with an `allocateIdentifierBetween(i, j)` query, and notes that "its performance depends crucially on the implementation of identifiers" ([RR Spec. 20, §3.5.2, pp. 35–36][rr]). It contrasts the partial-order approach with a total order, which avoids leaving concurrent inserts unordered and "can be implemented much more efficiently" ([RR §3.5, p. 33][rr]).

YATA's own complexity table (adapted from another paper, worst case, _H_ the number of operations) lists remote insertion at O(_H_²) for YATA and O(_H_) for RGA, and local insertion at O(log _H_) and O(_H_) respectively ([YATA §3.7, Table 1, PDF p. 7][yata]). These are that paper's figures for the implementations it compared, not general bounds.

## 7. Composing types into documents

Real data models nest these types. YATA builds every type from its list: a Replace Manager is a list whose first insertion is the value, a Map Manager maps keys to Replace Managers, and an XML element is a Map Manager for attributes plus a List Manager for children ([YATA §4, PDF pp. 7–8][yata]). Almeida et al.'s map embeds any causal CRDT recursively, for example `ORMap⟨N, ORMap⟨S, MVReg⟨E⟩⟩⟩` ([Almeida §7.4][delta]).

The local-first paper describes the result from the application side: if you would use "hash maps, lists, records/structs" in a single-user program, a collaborative one can "swap out those data structures for CRDTs" ([LFS §4.1, p. 168][lfs]). From building three prototypes on Automerge, the authors report that conflicts were rarer than feared and that default merge semantics were enough, and also that "CRDTs store all history, including character-by-character text edits", which caused performance and storage problems ([LFS §4.2.4, p. 172][lfs]). The companion notes on [maps](map-object-crdts.md) and [arrays](array-like-crdts.md) compare Yjs, Automerge and Loro.

## 8. Metadata and garbage collection across types

| Type                        | Extra state beyond the visible value                   | Can it be collected?                                                                             |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| LWW-Register                | One timestamp                                          | Nothing to collect                                                                               |
| MV-Register                 | Version vector (or dot) per concurrent value           | Values go when a later write supersedes them                                                     |
| G-/PN-Counter               | One entry per replica that ever wrote                  | Removing an entry needs commitment ([RR §4.2, p. 39][rr])                                        |
| 2P-Set                      | Tombstone per removed element                          | Removing tombstones (and so allowing re-adds) needs commitment ([RR §4.2, p. 39][rr])            |
| LWW-element-Set, LWW map    | Timestamp per element; tombstone per removed key       | Once the remove is stable ([RR §4.1, p. 38][rr]; [Roh §5.6, p. 363][roh])                        |
| OR-Set, add-wins set, ORMap | Unique tags or dots for live entries; a causal context | The context compresses to a version vector under causal anti-entropy ([Almeida §7.4][delta])     |
| RGA, WOOT, YATA             | Tombstone per deleted element                          | Once stable, plus RGA's right-neighbour condition ([Roh §5.6, p. 363][roh]); YATA uses a timeout |
| Treedoc, Logoot             | Identifier length; Treedoc tombstones                  | Rebalancing needs commitment ([RR §4.2, p. 39][rr])                                              |

RR-7506 separates two problems. **Stability:** metadata added to handle concurrent operations "serves no useful purpose" once every concurrent operation has been delivered. Detecting that uses Wuu and Bernstein's algorithm over vector clocks, and its liveness "requires that the set of replicas be known and that they not crash permanently (undetectably)" ([RR §4.1, p. 38][rr]; [SSS §4.2, p. 10][sss]). **Commitment:** resetting state across all replicas, such as dropping a counter entry or a 2P-Set tombstone, needs "an atomic, unanimous agreement between all replicas", or a small stable core that others reconcile with ([RR §4.2, p. 39][rr]). YATA sidesteps stability detection with a fixed delay and accepts that a site offline for longer than the delay cannot be supported ([YATA §3.5, PDF p. 6][yata]). [Persisting CRDT metadata](crdt-metadata-persistence.md) covers why this repository cannot drop tombstones by age.

## 9. This repository

Read from the working tree on 2026-11-24. `rga.ts` has uncommitted changes, so the RGA description may not match any commit.

- **`LWWRegister` is a state-based LWW-Register.** It holds `value` and a `Time` stamp; assigning `current` stamps with `Time.now()`; `merge` keeps the value with the later stamp and does nothing on equal stamps ([`lww-register.ts` L17–L58][nn-lww]). `merge` also copies the winning local value into the `remote` instance (L45–L49), so both objects end equal. `decode` passes every decoded stamp through `Time.receive` (L68–L76), which is what makes later local stamps exceed it, the causality condition RR-7506 asks of LWW timestamps ([RR §3.2.1, p. 19][rr]). `Time.compare` orders by physical time, counter, then replica id, so stamps are totally ordered ([`time.ts` L52–L65][nn-time]).
- **`LWWMap` is a fixed record, not an LWW map.** It holds a fixed set of named child entities and merges each local field with the remote field of the same name; "Fields only in `remote` are ignored", and there is no key removal ([`lww-map.ts` L7–L68][nn-lww-map]). That is the product composition of §5.4. The LWW behaviour comes from the `LWWRegister` children. The store maps object schemas to `LWWMap`, arrays to `RGA` and scalars to `LWWRegister` ([`create-strategy.ts` L14–L46][nn-strategy]).
- **`RGA` is a state-based RGA with per-key positions and permanent removal.**
  - Each position is `{ key, stamp, anchor }`, where `anchor` is the position it follows ([`rga.ts` L26–L31][nn-rga]).
  - Order is a depth-first walk of the anchor tree, visiting siblings in descending stamp order ("latest sibling first", L561–L586). That is RGA's ordering (§6.1).
  - `merge` joins the other replica's positions by stamp, re-anchors them, and unions removed keys (L506–L559). No causal buffer is involved.
  - A move mints a new position for the key (L246–L260), and the position with the latest stamp is the key's live one (L394–L398). This is the per-element position register from Kleppmann's move scheme, as [ADR-21][adr21] and [Implementing RGA §5.7](rga-implementation.md) describe.
  - Removed keys are kept forever and "no replica can add it back" (L34, L267–L273). Over keys, that is 2P-Set semantics (§4.2).
  - Row values are merged by the child entity's own `merge` (L86–L105).
- **Not present:** `packages/entities/src` has no counter, MV-Register, OR-Set or OR-Map. Every type in the package resolves concurrent writes to one field by LWW, and removals of list rows win permanently.

## 10. Evidence and limits

- **The local "Conflict-free Replicated Data Types.pdf" is the SSS 2011 conference paper**, not the catalogue. Every claim about the LWW-Register, MV-Register, G-Counter and PN-Counter specifications, the 2P-Set, LWW-element-Set, OR-Set, OR-Cart, RGA specification, continuum sequence and garbage collection comes from **RR-7506**, which is outside `docs/papers/`. I read it from a course-hosted copy of HAL's PDF because HAL's endpoints serve a bot challenge. Its metadata names HAL as creator; I did not compare it byte for byte with HAL's copy.
- **Almeida et al.** was read as arXiv v1 (2016), also outside `docs/papers/`. The journal version (JPDC 2018) may number sections or figures differently. I cite section and figure, not page.
- **RR-7506's OR-Cart is internally inconsistent.** Spec. 21 says `add` replaces the triples observed at the source ("Replace elements observed at source by new one"), while the prose says the new mapping "co-exists with existing mappings", and §5.2's interface calls `add(b, q′ − q)` to raise a quantity, which only makes sense if it co-exists. The summary in §5.2 above holds under either reading for concurrent adds, which survive and are summed. I did not resolve which is intended.
- **The OR-Map outcomes in §5.5 and the `bob ↦ {erik}` example in §5.3** are my derivations from the specifications, not examples printed in those papers. The companion note reports the same outcome from rust-crdt and Riak.
- **YATA's preprint has no page numbers**, so citations give PDF pages. Its complexity table is adapted from another paper, which I did not read.
- **WOOT, Treedoc, Logoot and LSEQ originals were not read.** Their rows in §6.2 rest on RR-7506's and YATA's descriptions, and on the array-like note for LSEQ. RR-7506 lists Logoot among designs that use stability-based GC, while YATA says Logoot needs no tombstones; I report both and did not check Logoot itself.
- **Library behaviour** (Akka `LWWMap`, Riak, rust-crdt, Automerge, Yjs, Loro) is cited from the companion notes and was not re-checked here.
- **Roh's per-type commutativity proofs** are in a technical report I did not read. The RHT tombstone purge rests on the paper's statement that Golding's condition covers RHTs ([Roh §5.6, p. 363][roh]).
- **DDIA and the local-first paper** are used for practical context only, not for claims about the algorithms.
- **The repository section** describes uncommitted code read on 2026-11-24. I did not run its tests.
- No code was run for this note.

## Sources

### Papers in `docs/papers/`

- [Shapiro et al., SSS 2011 (HAL preprint)][sss]
- [Roh et al., JPDC 2011][roh]
- [Nicolaescu et al., GROUP 2016 (YATA)][yata]
- [Kleppmann et al., Onward! 2019 (local-first)][lfs]
- [Kleppmann, _Designing Data-Intensive Applications_][ddia]

### Outside the local collection

- [Shapiro et al., RR-7506, HAL record][rr-hal]; [PDF used][rr]
- [Almeida, Shoker, Baquero, arXiv 1603.01529v1][delta]

### Repository sources

- [`packages/entities/src/lww-register.ts`][nn-lww], [`packages/entities/src/lww-map.ts`][nn-lww-map], [`packages/entities/src/rga.ts`][nn-rga], [`packages/time/src/time.ts`][nn-time], [`packages/store/src/reconciliation/create-strategy.ts`][nn-strategy]
- [ADR-19][adr19], [ADR-20][adr20], [ADR-21][adr21]

[sss]: ../../papers/Conflict-free%20Replicated%20Data%20Types.pdf
[roh]: ../../papers/Replicated%20Abstract%20Data%20Types%20-%20Building%20Blocks%20for%20Collaborative%20Applications.pdf
[yata]: ../../papers/Near%20Real-Time%20Peer-to-Peer%20Shared%20Editing%20on%20Extensible%20Data%20Types.pdf
[lfs]: ../../papers/Local-First%20Software%20-%20You%20Own%20Your%20Data,%20in%20Spite%20of%20the%20Cloud.pdf
[ddia]: ../../papers/Designing%20Data-Intensive%20Applications.pdf
[rr-hal]: https://inria.hal.science/inria-00555588
[rr]: https://www.csa.iisc.ac.in/~raghavan/CleanedPods2021/crdt-shapiro-2011-techreport.pdf
[delta]: https://arxiv.org/abs/1603.01529v1
[nn-lww]: ../../../packages/entities/src/lww-register.ts
[nn-lww-map]: ../../../packages/entities/src/lww-map.ts
[nn-rga]: ../../../packages/entities/src/rga.ts
[nn-time]: ../../../packages/time/src/time.ts
[nn-strategy]: ../../../packages/store/src/reconciliation/create-strategy.ts
[adr19]: ../../decisions/ADR-19-tombstone-removed-rows.md
[adr20]: ../../decisions/ADR-20-order-rows-with-a-state-based-rga.md
[adr21]: ../../decisions/ADR-21-move-rows-by-minting-new-positions.md
