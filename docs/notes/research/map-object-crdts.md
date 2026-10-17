# Map- and object-like CRDTs

Research date: **2026-09-28** (primary papers, official documentation, and source inspection).
Scope: records, dynamic dictionaries, nested objects, embedded CRDTs, and deletion/recreation semantics. Companion: [Array-like CRDTs](array-like-crdts.md).

## Short answer

Look for **map CRDT**, **replicated dictionary**, **OR-Map**, or **JSON/document CRDT**. There is no single map conflict policy. A map must decide both **which keys exist** and **what happens to concurrent values or edits under each key**. Nesting adds another question: does deleting a parent remove, reset, or merely hide its children? [Preguiça, §2.1.5][overview-map]

For applications, I would start with **Yjs `Y.Map`**, **Automerge maps**, or **Loro `LoroMap`**. For understanding maps that recursively merge and reset embedded CRDTs, start with **Almeida–Shoker–Baquero's causal OR-Map**, **Riak DT Map**, and **rust-crdt `Map`**. **Akka `ORMap`** is another useful composition example, but its remove/re-add behavior differs materially from reset-remove maps. These are recommendations, not a performance ranking. [Delta CRDTs, §7.4][delta] [Riak source][riak-map-src] [rust-crdt source][rust-map] [Akka maps][akka]

The most important practical distinction is:

```text
set("profile", {name: "Ada", city: "Prague"})  // assign a new whole value/object
profile.set("city", "Brno")                  // mutate the existing child
delete("profile")                           // remove the parent's binding
```

These operations target different things. A library's “update wins over delete” rule for assigning `profile` need not apply to changing `profile.city`. Automerge's own tests explicitly distinguish these cases. [Automerge merge rules][am-merge] [Automerge nested deletion tests][am-nested-tests]

## 1. Start with the shape and the operations

### Fixed record versus dynamic map

A **fixed record** with permanent fields can be a product of CRDTs: `{name: Register, enabled: Register, count: Counter}`. Each component merges independently. “Product” just means collecting several independently mergeable states into one state and merging corresponding components. If fields can be absent, an optional-value register can represent absence, but its assignment/deletion conflict policy still needs defining. [Delta CRDTs, §7.1, Pair][delta] [Register semantics][overview]

A **dynamic map** adds and removes keys. Dropping a local hash-table entry is insufficient: another replica may still contain the old entry. Merge must distinguish “I have never seen this value” from “I saw it and removed it.” LWW deletion records and observed-remove causal contexts are two different ways to carry that distinction. [Delta CRDTs, §§7.2, 7.4][delta]

**Recommendation:** use per-field CRDTs when the schema and object identity are stable. Introduce dynamic membership only where the application actually creates and deletes entries. This is a modeling simplification, not a claim that a particular implementation allocates less memory.

### Choose the granularity of conflict

Starting from `{name: "Ada", city: "Prague"}`:

```text
A changes name to "Grace"
B changes city to "Brno"
```

With independent field registers in the **same existing object**, both edits can survive: `{name: "Grace", city: "Brno"}`. If each client instead writes an entire serialized object to one LWW register, one whole object wins. An MV register preserves the two whole-object alternatives; it does not infer a field-by-field merge. This follows from the registers' opaque-value interface. [Register definitions][overview] [Automerge conflict granularity][am-conflicts]

**Deduction:** finer granularity preserves independent edits, but can combine fields into a state no individual user wrote. For example, independently updating `start` and `end` can violate `start <= end`. Convergence and local transaction batching do not by themselves establish application invariants; those need a suitable data model or stronger coordination. [Overview, §§2.3.2–2.3.3][overview]

### Terms used below

- **Concurrent:** neither operation had observed the other when it was issued. This is about causal knowledge, not simultaneous wall-clock execution.
- **Register:** one logical slot supporting assignment. LWW selects one value; MV retains causally concurrent alternatives.
- **Binding/slot:** the association from a map key to its current value or child object.
- **Embedded CRDT:** a value with its own CRDT operations and merge behavior, such as a counter, set, text, or nested map.
- **Object identity:** which particular child an operation addresses. A textual path such as `profile.city` can point to a different child after replacing `profile`.

The causality, register, and embedding terms follow the overview; object identity versus logical-key identity is explicit in Loro's container documentation. [Overview, §§2.1–2.1.5][overview] [Loro container IDs][loro-cid]

## 2. The policy has several independent parts

| Question                                  | Possible answers                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Two assignments to the same key?          | Pick one by a total order; retain all concurrent alternatives; merge values using their CRDT    |
| Assignment versus key deletion?           | Assignment wins; removal wins; compare ordered write/delete versions                            |
| Child mutation versus parent deletion?    | Hide the child; reset observed child contributions; preserve the whole updated child            |
| Two peers create a child at the same key? | Distinct objects competing for the binding; one shared logical-key child                        |
| Delete and recreate?                      | Fresh incarnation; reset old contributions; reactivate preserved state; merge old and new state |
| Competing value types?                    | Select one; expose alternatives; use separate `(key, type)` namespaces                          |

These are choices found in the papers and implementations, rather than features guaranteed by the words “map CRDT.” [Overview, §2.1.5][overview-map] [Automerge tests][am-map-tests] [Loro IDs][loro-cid] [Loro declarations][loro-types] [Akka maps][akka]

In particular, **“LWW-map” does not uniquely specify deletion**. It may mean per-key LWW registers where deletion is an ordered absent value. Akka's `LWWMap`, however, is an **observed-remove map of LWW registers**: observed-remove membership and LWW value arbitration are separate layers. [Akka maps/registers][akka] [Loro map implementation][loro-map-state] [Loro delete implementation][loro-handler]

## 3. Main families

### LWW registers and maps

A **last-writer-wins register** associates writes with a deterministic total order and selects the greatest one. A common map construction keeps one such register per key, with a distinguished absent value for deletion. If set and delete are both writes to that register, their versions decide the outcome; neither operation kind universally wins. Loro implements this pattern with `MapValue { value: Option<LoroValue>, lamp, peer }`, using `None` for deletion and comparing Lamport value followed by peer ID. [LWW definitions][overview] [Loro ordering][loro-map-delta] [Loro delete implementation][loro-handler]

**“Last” need not mean latest physical time.** A Lamport clock is a logical counter advanced to respect causal dependencies; a larger Lamport value does not prove an event happened later in real time or that it observed another event. A replica/actor ID can break ties. Loro documents logical-time arbitration, and Automerge explicitly says its visible conflict winner uses operation counter then actor ID, not wall-clock time. Akka's default LWW register uses timestamps with clock-synchronization caveats, illustrating a different choice. [JSON paper, §IV-B1][json-paper] [Loro map][loro-map] [Automerge conflicts][am-conflicts] [Akka registers][akka]

Example, for a map whose delete participates in LWW ordering:

```text
A: set(k, 2), version (10, A)
B: delete(k), version (11, B)
merge: k absent
```

Reverse the version ordering and the assignment wins. This is an illustrative consequence of the ordering rule, not a runtime observation. A deletion record cannot simply be forgotten while a stale replica can still supply the lower-version value. [Loro ordering/state][loro-map-delta] [Delta CRDTs, LWW set construction][delta]

### MV registers and maps

A **multi-value register** keeps writes that have not been causally superseded. Two concurrent assignments of `1` and `2` produce alternatives `{1, 2}`. A subsequent assignment made after observing both supersedes both. An offline assignment that has not observed one alternative cannot resolve it. [Delta CRDTs, §7.4, MV register][delta]

A map of MV registers applies that rule independently at each key. It is not the same as a multimap used to intentionally store several collection members: the values here are unresolved assignment alternatives. Deletion remains a separate policy. For example, the delta paper's `clear` removes observed register dots, allowing an unseen concurrent write to survive; the overview also specifies a remove-wins map with MV entry values. [Delta CRDTs, Fig. 14][delta] [Overview, Map of literals][overview-map]

Automerge combines a single deterministic **visible winner** with an MV-style conflict API. `getConflicts(object, key)` returns the concurrent values, including the winner. Reassigning after observing the conflict resolves those observed alternatives. A UI that reads only `object[key]` does not show all of the retained information. [Automerge conflicts][am-conflicts]

**Recommendation:** prefer conflict exposure when choosing the wrong concurrent value matters and a user or domain-specific process can resolve it. An MV register preserves the alternatives; the application still needs a useful resolution workflow.

### Observed-remove sets, ORSWOT, and map membership

An **observed-remove set**, also called an add-wins set, removes the additions the removing replica has seen. A concurrent unseen addition survives. A usual construction gives additions unique **dots**, pairs such as `(replica A, counter 7)`. These are event identities, not timestamps measured in seconds. [Delta CRDTs, §7.4][delta] [Riak ORSWOT source][orswot]

**ORSWOT** means observed-remove set without tombstones. It is a **set**, not a complete map-value policy. It stores live element dots and a causal summary of known dots, so deletion can discard per-element payload while retaining knowledge that old additions were observed. This can support a map's key set, but says nothing by itself about merging counters or deleting a nested object. [Riak ORSWOT source][orswot] [Akka sets/maps][akka]

An **add/update-wins map** typically makes a fresh key addition, direct assignment, or an embedded update count as new evidence of presence. Which operations count is crucial. Updating through an OR-Map API can refresh membership; mutating a child object reached through a parent reference need not rewrite the parent binding. Compare Akka/rust-crdt's map update APIs with Automerge's nested-deletion test. [Akka maps][akka] [rust-crdt map][rust-map] [Automerge nested deletion][am-nested-tests]

### Reset-remove maps: remove observed contributions

The causal OR-Map in the delta paper uses one shared causal context across the map and its embedded components. Removing a key removes the dots of the associated child recursively. A concurrent child contribution not included in the removal context can survive, while previously observed contributions stay removed. The map does not need a separate “create” operation: applying a child operation at a missing key starts from that child's bottom state. [Delta CRDTs, §7.4, Fig. 17][delta]

**Reset-remove** describes this effect on embedded state. Suppose a map contains a set:

```text
Initial: friends["bob"] = {"janet"}
A: remove friends["bob"]
B: add "erik" to friends["bob"]
Merged reset-remove result: friends["bob"] = {"erik"}
```

`bob` survives because of the concurrent addition, but `janet` does not. This is exactly the example in rust-crdt's first-party `reset_remove.rs`, and Riak documents the same set-field semantics. The example source was read, not executed for this note. [rust-crdt example][rust-reset] [Riak map semantics][riak-map-src]

This requires more than calling `child.merge(otherChild)`: the child must support embedding and removal of the relevant observed information. rust-crdt requires a `ResetRemove` trait; Riak explicitly restricts embeddable types to ones supporting its shared dot context and reset-remove contract. A standalone PN-counter is not automatically an observed-reset counter. [rust-crdt map traits][rust-map] [Riak embedding contract][riak-map-src]

### Remove-wins and whole-object update-wins are different policies

The overview distinguishes three behaviors for deleting a parent concurrently with editing a descendant. Starting with a player who has `10` coins and `{hammer}`, one peer removes the player while another adds `nail`:

| Policy                    | Merged result                                                           |
| ------------------------- | ----------------------------------------------------------------------- |
| Remove-as-recursive-reset | Player survives with the concurrent `nail`; observed old state is reset |
| Remove-wins               | Player is absent; concurrent descendant edit does not preserve it       |
| Whole-object update-wins  | Player survives with `10` coins and `{hammer, nail}`                    |

These are the overview's examples, not interchangeable descriptions of one OR-Map. The exact treatment of the reset bottom depends on the child type. Its update-wins section also shows that multiple removes/recreations need a more careful definition than “cancel every concurrent delete.” [Overview, §2.1.5, Figs. 3–6][overview-map]

A **remove-wins map** can suppress both prior and concurrent updates at the removed key or its descendants. A later update that has observed the relevant removals can recreate state; remove-wins does not necessarily mean permanent removal. A two-phase set's permanent prohibition on re-addition is a different contract. [Overview, Map/Set and §2.2][overview]

**Recommendation:** use a remove-wins lifecycle when deleting an entity should defeat stale concurrent work on that entity. Specify whether later work is allowed to recreate it, and whether recreation gets a new identity. A timestamp-winning delete is not equivalent: a concurrent write with a larger timestamp could still win.

## 4. Dots and causal context, without the notation overhead

The causal construction has two parts:

1. A **dot store** holds the currently relevant contributions, organized as sets, dot-to-value mappings, or nested key-to-dot-store mappings.
2. A **causal context** records which dots are known, including ones no longer in the live store.

If a dot is in the context but absent from the store, it represents information that was removed. When merging, keep contributions present on both sides, and contributions one side has not yet observed. Discard contributions absent from a side that already knows their dot. [Delta CRDTs, §7.4, Figs. 10–12][delta]

For a simple dot set, the paper's merge can be read as:

```text
live = (liveA ∩ liveB)
     ∪ (liveA minus contextB)
     ∪ (liveB minus contextA)
context = contextA ∪ contextB
```

For nested maps, the construction applies the corresponding causal merge recursively to each child with the shared context. This is not plain union of visible maps. [Delta CRDTs, Fig. 12][delta]

Example: A deletes observed dot `(X, 1)`. B still has `(X, 1)` plus a concurrent addition `(B, 1)`. A's context rejects `(X, 1)` but does not reject `(B, 1)`, leaving only the new contribution. If A also discarded its context, it could no longer distinguish the removed dot from a new one. [Deduction from causal merge, Fig. 12][delta]

A **version vector** compresses a contiguous prefix of dots into one maximum counter per replica. If dots can arrive with gaps, storing only the maximum would falsely claim knowledge of missing events. The delta paper uses a version vector plus exceptional dots for such contexts and discusses causal delta merging separately. [Delta CRDTs, §§6, 7.4, 8.3][delta]

**Delete/recreate is why the context must outlive the child.** Recreating a key with a fresh empty private context can make old state from another replica look new. The paper explicitly avoids that anomaly by sharing a context across embedded values and never resetting that map-wide context during key removal. [Delta CRDTs, Map embedding causal CRDTs][delta]

## 5. Nested identity versus path and whole-value replacement

### Editing the same object is not creating two similar objects

For Yjs, Automerge, and regular Loro child containers, initialize a child once and distribute that common creation before editing it independently. If peers each create a new child under `profile`, the two children have different identities and compete for the parent binding. Their contents are not automatically combined merely because both appear at `profile`. [Yjs shared types/integration][y-shared] [Yjs map integration][y-item] [Automerge initialization guidance][am-model] [Automerge competing maps test][am-map-tests] [Loro container overwrites][loro-cid]

```text
Shared child already exists:
  A: profile.name = "Ada"
  B: profile.city = "Brno"
  -> both fields can be present in that child

Two children independently created at the same parent key:
  A: profile = new child {name: "Ada"}
  B: profile = new child {city: "Brno"}
  -> binding conflict; do not assume {name: "Ada", city: "Brno"}
```

The first result follows independent-field merging; the second is explicitly tested by Automerge and demonstrated in Loro's docs. [Automerge conflicts][am-conflicts] [Automerge competing maps test][am-map-tests] [Loro IDs][loro-cid]

### A path-based design is a real alternative

Kleppmann and Beresford's **2017 JSON CRDT paper** uses typed paths through maps and merges concurrently created containers at the same logical location. Its Fig. 2 replaces a colors map while another peer adds a color: the old observed color disappears, but concurrent additions from both branches survive. Fig. 3 merges two independently created lists under the same map key. [JSON paper, §III-A][json-paper]

**Do not use that paper as a specification of current Automerge nesting.** Automerge's current first-party tests explicitly say “should not merge concurrently assigned nested maps,” and its initialization docs warn about independent schema creation. The paper is useful for understanding another coherent composition policy. [Automerge tests][am-map-tests] [Initialization guidance][am-model]

### Loro exposes both identity choices

Regular Loro `setContainer` creates an operation-derived child identity. Current documentation and the published **`loro-crdt@1.16.3` declarations** also expose `ensureMergeableMap`, `ensureMergeableText`, and equivalent methods for other types. These use an identity derived from **parent Map, key, and container type**, so independent initialization of the same logical child can merge its edits. [Loro IDs][loro-cid] [Published declarations][loro-types]

The lifecycle is important: deleting a mergeable key clears its parent reference and hides the child, but **does not reset the child**. Calling the same `ensureMergeable*` again resurfaces its preserved state. This is documented in the published declarations and covered by upstream tests. It is different from reset-remove. [Loro declarations][loro-types] [Pinned delete/recreate tests][loro-mergeable-delete]

**Recommendation:** use logical-key identity when independent peers mean “the same notes body.” Use a fresh child identity when recreation means “a new entity.” For records identified by an application ID, decide whether reusing that ID means resuming the old entity or creating another incarnation.

## 6. Practical library comparison

The deletion column below concerns an actual **new direct assignment to the parent key**, concurrent with deleting an existing binding from a shared starting state. It does not imply the same outcome for mutation inside its child.

| Type                                                              | Same-key concurrent assignments                                                         | Direct set versus delete                                                                 | Nested values and lifecycle                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Yjs `Y.Map`**                                                   | One deterministic visible entry; losing map items are marked deleted                    | In the simple shared-base two-branch case, the new set survives deletion of the old item | Nested shared types merge when editing the same child; deleting/replacing its parent removes that child from the visible tree                    |
| **Automerge map**                                                 | Deterministic visible winner plus concurrent alternatives through `getConflicts`        | Direct assignment wins                                                                   | Same existing child merges internally; independently assigned children conflict; deleting the parent hides concurrent edits inside the old child |
| **Loro `LoroMap`**                                                | Greatest `(Lamport, peer ID)` for the slot                                              | Set and delete use the same ordering; either can win                                     | Regular children have distinct creation IDs; mergeable children share logical-key identity and preserved state can reappear after reactivation   |
| **Causal OR-Map in the delta paper / rust-crdt reset-remove map** | Merge compatible embedded CRDT contributions; register choice controls scalar conflicts | Unobserved concurrent contributions survive observed removal                             | Removes observed child contributions recursively; child must support the embedding/reset contract                                                |
| **Riak DT Map**                                                   | Embedded type policy; fields include the type in their identity                         | Observed-remove membership; concurrent update can keep field present                     | Reset-remove for sets/maps; source documents a counter-specific exception                                                                        |
| **Akka `ORMap`**                                                  | Calls the embedded `ReplicatedData` merge                                               | Observed-remove key membership                                                           | Re-addition does not guarantee fresh child state; old/new values at the same key can merge; value type must stay fixed                           |

Sources for each row: [Yjs internals][y-internals], [map setters/deleters][y-abstract], [item integration][y-item]; [Automerge merge rules][am-merge], [conflicts][am-conflicts], [nested tests][am-nested-tests]; [Loro ordering][loro-map-delta], [delete implementation][loro-handler], [declarations][loro-types]; [delta paper][delta], [rust-crdt][rust-map]; [Riak map source][riak-map-src]; [Akka map documentation][akka]. Yjs's pairwise result is a source-derived deduction, not a claim that its behavior is identical to every add-wins/MV map under arbitrary histories.

### Yjs: use shared values for field editing

`Y.Map` has string keys and accepts JSON-encodable values, byte arrays, and nested shared types. A plain JavaScript object stored as a value is not a recursively shared object. Mutating it directly does not emit a replicated field update; Yjs warns that it can change local internal data without notifying peers. Use a nested `Y.Map` for independently editable fields. [Y.Map API][y-map] [Shared-type caveats][y-shared]

Internally, map assignments are ordered items associated with a key. `typeMapSet` creates a fresh item after the current key item; `typeMapDelete` deletes the current item by identity. `Item.integrate` arbitrates concurrent items and marks non-current items deleted. For two competing insertions with the same origin, client ID participates in ordering. This is not a wall-clock map, nor should it be summarized as simply taking the maximum per-client counter. [Pinned setter/deleter source][y-abstract] [Pinned integration source][y-item]

Deleting an item containing a nested shared type recursively deletes its contents; a later-arriving item whose parent is deleted is deleted during integration. A shared type also cannot be integrated a second time elsewhere. Consequently, changing a field inside an old child does not preserve a deleted parent binding, and creating a new child at the old key does not turn old-child edits into edits to the new child. [ContentType deletion][y-content] [Item integration][y-item] [Shared-type caveats][y-shared]

### Automerge: direct assignment and nested mutation differ

For scalar numbers, the documented behavior gives:

```text
Initial {k: 1}
A: delete k
B: k = 2
Result: {k: 2}
```

For an existing nested object:

```text
Initial {profile: {name: "Ada", city: "Prague"}}
A: delete profile
B: profile.city = "Brno"
Result: profile absent from the visible root
```

The first follows the public map merge rules. The second matches the pinned first-party test where one branch deletes `animals.birds` and the other adds `animals.birds.brown`; the merged document omits `birds`. These are documented/source expectations, not new runtime measurements. [Merge rules][am-merge] [Nested deletion test, lines 1317–1340][am-nested-tests]

Automerge retains conflicting child-object assignments and their internal data as alternatives. This differs from automatically merging the separately created children into one. Use fine-grained mutations inside `change` when editing an existing object; create a replacement when replacement is the intended operation. [Conflicts][am-conflicts] [Competing child maps tests][am-map-tests]

### Loro: a child mutation is not another parent-slot write

Loro's ordinary `set`, `delete`, and `setContainer` operate on the parent slot. Child operations target the child container. Thus a concurrent child mutation alone does not replace the parent's deletion with a newer slot value. A fresh parent-slot assignment competes by LWW; a mutation in an already-existing child does not enter that same arbitration. This is a deduction from the container model, map implementation, and mergeable-child deletion tests. [Loro IDs][loro-cid] [Map state][loro-map-state] [Delete tests][loro-mergeable-delete]

Also account for **no-op detection**: Loro documents `map.set(key, value)` as producing no operation when the existing value already equals it. Re-ensuring an already-visible mergeable child is likewise idempotent in the tested implementation. Code that appears to “assert presence” may therefore not create a new competing parent write. [Loro map tutorial][loro-map] [Mergeable deletion tests][loro-mergeable-delete]

### Riak and Akka: two useful but different embedding examples

Riak identifies fields as `(name, CRDT type)`, supports nested maps, and requires causal context for observed removals from the client API. Its source describes deferred removes when a server has not yet received all the state that the client's removal context observed. This is important when the client issuing an operation is not itself one of the storage replicas. [Riak map docs][riak-map] [Source, Context and Deferred operations][riak-map-src]

Riak's map source also documents an **embedded-counter anomaly**: a fresh per-actor counter dot can include earlier accumulated contributions, so concurrent removal does not always reset the counter down to only the concurrent increment. Therefore, the overview's idealized example `2`, concurrent `+1` and remove, yielding `1`, must not be presented as a universal Riak counter result. [Riak counter caveat][riak-map-src] [Overview reset example][overview-map]

Akka's `ORMap` instead merges `ReplicatedData` values for the same key and explicitly warns that removing and re-adding a key can resurrect old value state through later merges. It prohibits changing the value's CRDT type for a key. Its specializations include `PNCounterMap`, `ORMultiMap`, and `LWWMap`; the last is OR-Map membership around LWW register values, not LWW arbitration between deletion and assignment. [Akka maps][akka]

## 7. Protocol, metadata, and garbage collection

### The map algorithm and the transport contract are separate

- **State-based:** merge full CRDT states using an associative, commutative, idempotent join. The state includes causal/deletion metadata, not just visible JSON.
- **Operation-based:** correctness depends on the stated delivery, dependency, and deduplication requirements. Do not assume every raw operation can be applied in arbitrary order.
- **Delta-state:** a delta is a joinable fragment of CRDT state, not an arbitrary JSON patch. The delta paper separates eventual convergence from the causal delta-merging condition needed to reproduce full-state semantics.

These distinctions and their assumptions are specified in the delta paper and overview. [Delta CRDTs, §§3–6][delta] [Overview, §3.1][overview]

Yjs's public binary update API explicitly accepts reordered and duplicate updates, provided all updates eventually arrive. That guarantee belongs to its complete update format and dependency handling. Akka's documentation explicitly requires **causal delivery of deltas** for ORSet and its ORMap family. rust-crdt's map source validates update source order and retains deferred removal contexts. [Yjs updates][y-updates] [Akka delta requirements][akka] [rust-crdt validation/deferred operations][rust-map]

**Recommendation:** persist and exchange the library's CRDT encoding, not just `toJSON()` followed by reconstruction. Visible values omit IDs, observed-write alternatives, and removal context needed for subsequent merges. This follows directly from the state/context construction and the documented binary update APIs. [Delta causal states][delta] [Yjs updates][y-updates] [Automerge conflicts][am-conflicts]

### “No tombstones” is not “no historical knowledge”

Separate four things: logical deletion, collecting deleted payload, compressing metadata, and forgetting old causal/history information. ORSWOT can remove per-element records because a shared causal context still rejects stale dots. The context itself must remain meaningful. Riak even uses a field-local structure named `tombstone` for currently present fields while describing the map as tombstoneless; the source explains that it is removed with the field. [ORSWOT source][orswot] [Riak map source][riak-map-src] [Delta context compression][delta]

Yjs can collect deleted content while retaining synchronization structure; `mergeUpdates` only combines binary updates and does not perform that collection. Automerge documents retain change history, so absence from the visible tree is not equivalent to erasing historical data. Loro shallow snapshots explicitly trim old history and restrict which older replicas can synchronize normally. [Yjs internals][y-internals] [Yjs update API][y-updates] [Automerge modeling/history][am-model] [Loro shallow snapshots][loro-shallow]

**Deduction:** safe forgetting needs a protocol-level answer to stale replicas and in-flight operations. An LWW deletion version or an observed-remove causal summary cannot be discarded solely because its key is currently invisible. For long-offline clients, define a retention boundary and how a client older than it rejoins. [Causal merge and stale-entry suppression][delta] [Loro synchronization limit][loro-shallow]

### Costs to measure

Measure live keys, distinct keys ever used, concurrent alternatives, number of replica IDs, retained operation history, nesting depth, and delete/recreate churn separately. Vector metadata can grow with actors; MV values can grow with unresolved concurrency; LWW deletion entries and retained history can outlive visible values. Riak's source discusses divergent field versions and actor metadata, while Loro's declarations note that deep mergeable-map chains increase container-ID size. These observations identify workload dimensions, not a cross-library speed ranking. [Overview, §4.1][overview] [Riak size discussion][riak-map-src] [Loro declarations][loro-types] [Loro map snapshot state][loro-map-state]

## 8. Decision guidance

The following are recommendations derived from the semantics above:

- **Fixed settings or a stable record:** independent field registers are a good starting model. Choose LWW or MV according to whether concurrent alternatives matter.
- **Editable nested application state:** compare Yjs, Automerge, and Loro on lifecycle and replacement semantics before comparing throughput. Share initial child identity, or deliberately use Loro's logical-key mergeable children.
- **Need to inspect conflicting assignments:** Automerge's `getConflicts` is a direct application-facing option. Decide how the UI resolves conflicts, including conflicting child objects.
- **Dictionary of counters, sets, or nested maps with observed reset:** study the causal OR-Map and reset-remove interface. Validate the particular child type, especially counters, rather than assuming arbitrary CRDTs embed correctly.
- **Deletion must defeat concurrent work:** choose or construct an explicit remove-wins lifecycle. A library's add-wins direct assignment, LWW delete, or hidden child state may not match that requirement.
- **Delete means a fresh start on recreation:** use explicit incarnations/fresh child IDs. Loro mergeable reactivation and Akka same-key value merging require particular care here.
- **Entity data plus ordering:** keep application entity identity distinct from a sequence occurrence. A separate record map can help, but map convergence does not establish referential integrity or an identity-preserving move policy by itself.

Basis: [register/map taxonomy][overview-map], [causal composition][delta], [Automerge conflicts][am-conflicts], [Yjs shared types][y-shared], [Loro IDs/declarations][loro-cid], [Loro lifecycle][loro-types], [Akka recreation caveat][akka], and the [companion sequence note](array-like-crdts.md).

### Scenarios to check in the actual application

Use a shared initial history, fork independent replicas, record the exact operations, then merge both ways. Include three-replica histories where a stale peer returns after a removal and recreation. Suggested cases:

1. Different-field edits to the same existing child.
2. Conflicting scalar assignments, with and without an intervening synchronization.
3. Direct assignment versus deletion, including an assignment of the already-visible value.
4. Nested mutation versus deletion/replacement of its parent.
5. Concurrent independent child creation at the same key.
6. Delete/recreate versus stale edits to the previous incarnation.
7. A merged conflict followed by another assignment or delete, then a third offline write.
8. Save/load, duplicate delivery, delayed dependencies, and synchronization after compaction.

This is a recommended validation matrix, not a claim that these experiments were run. The cases are motivated by the documented conflict, embedding, and protocol distinctions above.

## 9. Runtime spot checks, 2026-09-28

These are original observations under Node.js **26.8.2**, using installed packages **Yjs 13.6.33**, **Automerge 3.5.0**, and **Loro 1.16.3**, confirmed with `npm ls --depth=0`. Each concurrent case used two independently edited replicas, captured both branches before cross-importing, and asserted equal visible values after merging in both directions. The checks covered 30 ordinary-map histories, one Loro mergeable-child history, three JSON-value-versus-nested-field comparisons, and one sequential Loro hide/restore case — 34 concurrent histories plus the sequential case in total. These are specific examples, not a correctness proof or benchmark, and they do not claim to reproduce every concurrent schedule.

For deterministic examples, the seed actor/peer ID was 1, peer A was 2, and peer B was 3; Automerge used zero-padded hexadecimal actor IDs. Unless specified otherwise, the initial scalar entry was `{x: 0}`, and the initial nested shared child was `{child: {a: 0, b: 0}}`.

| Concurrent operations                                                            | Yjs `Y.Map`             | Automerge map                                 | Loro `Map`              |
| -------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------- | ----------------------- |
| A sets `a=1`; B sets `b=2`                                                       | Both fields survive     | Both fields survive                           | Both fields survive     |
| A sets `x=1`; B sets `x=2`                                                       | Visible `x=2`           | Visible `x=2`; `getConflicts` exposes 1 and 2 | Visible `x=2`           |
| A sets `x=1`; B deletes `x`                                                      | `{x:1}`                 | `{x:1}`                                       | `{}`                    |
| A deletes `x`; B sets `x=2`                                                      | `{x:2}`                 | `{x:2}`                                       | `{x:2}`                 |
| A edits existing `child.a=1`; B edits `child.b=2`                                | `{child:{a:1,b:2}}`     | `{child:{a:1,b:2}}`                           | `{child:{a:1,b:2}}`     |
| A edits `child.a=1`; B deletes `child`                                           | `{}`                    | `{}`                                          | `{}`                    |
| A deletes `child`; B edits `child.a=2`                                           | `{}`                    | `{}`                                          | `{}`                    |
| A edits old `child.a=1`; B replaces `child` with a new shared child `{b:2}`      | `{child:{b:2}}`         | `{child:{b:2}}`                               | `{child:{b:2}}`         |
| Initially absent: A creates child `{a:1}`; B independently creates child `{b:2}` | Visible `{child:{b:2}}` | Visible `{child:{b:2}}`                       | Visible `{child:{b:2}}` |
| A deletes and recreates `child` as `{fresh:1}`; B edits old `child.a=2`          | `{child:{fresh:1}}`     | `{child:{fresh:1}}`                           | `{child:{fresh:1}}`     |

Here "visible" describes the ordinary read result; it does not claim that hidden conflicts or historical operations have been erased. For same-key assignments and concurrent regular child creation, the winning peer depends on each library's conflict order. Swapping assignment and deletion between A and B changed Loro's result (compare rows 3 and 4), so these examples must not be summarized as a universal delete-wins or update-wins rule. This confirms, with runtime evidence, the same distinction the sourced sections above draw between a parent-key write and a nested-field mutation: for Yjs and Automerge, an existing child's field edit did not survive deletion of its parent, matching the pinned Yjs integration behavior and the Automerge nested-deletion test cited in §5 and §6.

### Loro mergeable children, confirmed at runtime

Loro **1.16.3** also exposes `ensureMergeableMap(key)`. Two independent peers calling this on the same root map and key got identical child IDs. A wrote `a=1`, B wrote `b=2`, and both converged to `{child:{a:1,b:2}}`. By contrast, regular `setContainer(key, new LoroMap())` created distinct child identities and selected one visible branch in the ordinary-map test above (the "concurrent independent child creation" row).

After deleting the mergeable child's key, the visible parent was `{}`. Calling `ensureMergeableMap` again restored the same child ID and its previous `{a:1,b:2}` state. This is reuse, not creation of an empty replacement, and it runtime-confirms the lifecycle documented in the published declarations cited in §5 and §6. [Loro 1.16.3 declarations][loro-types]

### JSON-value replacement versus nested-field mutation, confirmed at runtime

Three additional concurrent histories checked atomic JSON values versus nested shared maps. Starting with `{child:{a:0,b:0}}`, Yjs and Loro stored `child` using ordinary `map.set('child', {a:0,b:0})`. A wrote a copied replacement with `a=1`, B wrote a copied replacement with `b=2`; both converged to `{child:{a:0,b:2}}` — one whole-object write beat the other, matching the LWW-per-key model in §3. Automerge instead initialized the same JSON with `from`, then A changed `child.a` and B changed `child.b` inside `change`; both converged to `{child:{a:1,b:2}}`, matching independent-field merging in an existing shared object. These deliberately use different edit APIs to make the point concrete: replacing a whole JSON payload competes at its parent key, while mutating fields of an existing shared child merges at those fields.

Reproduction: install `yjs@13.6.33`, `@automerge/automerge@3.5.0`, and `loro-crdt@1.16.3` under Node.js 26.8.2. For Yjs, use `encodeStateAsUpdate`/`applyUpdate`; for Automerge, use `save`/`load` and `merge`, with mutations inside `change`; for Loro, use `export({mode:'snapshot'})`/`import`, and `setContainer` for regular (non-mergeable) children. Initialize each pair from the same seed before editing, export both edited branches before merging either, and compare both visible results.

## 10. Evidence and limits

This note is source-based research with small runtime spot checks (§9), not a benchmark or a correctness proof. Upstream test expectations are identified as such. The companion array note's experiments are not reused as map runtime evidence; the map runtime checks above are new and specific to map/object semantics.

- The main formal sources inspected were Almeida, Shoker, and Baquero's **2016 arXiv delta-CRDT manuscript**, Preguiça's **2018 overview**, and Kleppmann/Beresford's **2017 JSON paper, v3**. Their map policies are distinguished from current library behavior.
- Yjs source is pinned to `9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c`; Automerge tests to `ddbff535407e4d28cd2a82eaf6c6add08caa3bdd`; Loro source/tests to `27982a553733c54574c2ab63d56ba343b69aa8cb`. Source pins are not automatically release-version claims.
- Loro's mergeable-child API and delete/reactivate behavior were checked both in published **1.16.3** TypeScript declarations and, in §9, by running the installed package. The declarations remain documentation evidence; §9 is execution evidence for the specific histories tested.
- Riak `develop`, rust-crdt `master`, and official documentation links can change. Riak is included as a canonical embedding design; no claim is made here about its current operational maintenance status.
- Exact behavior for an application still depends on its selected versions, no-op handling, how it creates objects, and whether deletion means hiding, resetting, or a new incarnation. The Yjs comparison deliberately states a simple pairwise set/delete case rather than equating its whole algorithm with a generic OR-Map.

## Primary sources

- [Preguiça, _Conflict-free Replicated Data Types: An Overview_ (2018)][overview], especially [§2.1.5, Map][overview-map]. Register/value policy, recursive reset, remove-wins, and whole-object update-wins taxonomy.
- [Almeida, Shoker, Baquero, _Delta State Replicated Data Types_ (2016 manuscript)][delta]. Product composition, causal contexts, dots, registers/sets, embedded OR-Map, and dissemination contracts.
- [Kleppmann, Beresford, _A Conflict-Free Replicated JSON Datatype_ (2017 v3)][json-paper]. Typed-path composition, concurrency examples, and Lamport ordering.
- [Y.Map API][y-map], [shared-type caveats][y-shared], [internals][y-internals], [setter/deleter source][y-abstract], [item integration][y-item], [child deletion][y-content], [update API][y-updates].
- [Automerge merge rules][am-merge], [conflicts][am-conflicts], [modeling/initialization][am-model], [competing-map tests][am-map-tests], [nested deletion tests][am-nested-tests].
- [Loro map][loro-map], [container IDs][loro-cid], [published declarations][loro-types], [map version ordering][loro-map-delta], [map state][loro-map-state], [delete implementation][loro-handler], [mergeable deletion tests][loro-mergeable-delete], [shallow snapshots][loro-shallow].
- [Riak map guide][riak-map], [map source and semantic caveats][riak-map-src], [ORSWOT source][orswot].
- [rust-crdt map source][rust-map] and [reset-remove example][rust-reset].
- [Akka Distributed Data: maps, registers, and delta contracts][akka].

[overview]: https://arxiv.org/html/1806.10254v1
[overview-map]: https://arxiv.org/html/1806.10254v1#S2.SS1.SSS5
[delta]: https://arxiv.org/html/1603.01529v1
[json-paper]: https://arxiv.org/html/1608.03960v3
[y-map]: https://docs.yjs.dev/api/shared-types/y.map
[y-shared]: https://docs.yjs.dev/getting-started/working-with-shared-types
[y-internals]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/INTERNALS.md
[y-abstract]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/types/AbstractType.js#L830-L892
[y-item]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/structs/Item.js
[y-content]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/structs/ContentType.js
[y-updates]: https://docs.yjs.dev/api/document-updates
[am-merge]: https://automerge.org/docs/reference/under-the-hood/merge-rules/
[am-conflicts]: https://automerge.org/docs/reference/documents/conflicts/
[am-model]: https://automerge.org/docs/cookbook/modeling-data/
[am-map-tests]: https://github.com/automerge/automerge/blob/ddbff535407e4d28cd2a82eaf6c6add08caa3bdd/javascript/test/legacy_tests.ts#L1151-L1208
[am-nested-tests]: https://github.com/automerge/automerge/blob/ddbff535407e4d28cd2a82eaf6c6add08caa3bdd/javascript/test/legacy_tests.ts#L1317-L1340
[loro-map]: https://loro.dev/docs/tutorial/map
[loro-cid]: https://loro.dev/docs/advanced/cid
[loro-types]: https://unpkg.com/loro-crdt@1.16.3/bundler/loro_wasm.d.ts
[loro-map-delta]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-internal/src/delta/map_delta.rs#L20-L46
[loro-map-state]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-internal/src/state/map_state.rs
[loro-handler]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-internal/src/handler.rs#L4477-L4502
[loro-mergeable-delete]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-internal/tests/mergeable_container/delete.rs
[loro-shallow]: https://loro.dev/docs/concepts/shallow_snapshots
[riak-map]: https://docs.riak.com/riak/kv/2.2.3/developing/data-types/maps/index.html
[riak-map-src]: https://github.com/basho/riak_dt/blob/develop/src/riak_dt_map.erl
[orswot]: https://github.com/basho/riak_dt/blob/develop/src/riak_dt_orswot.erl
[rust-map]: https://github.com/rust-crdt/rust-crdt/blob/master/src/map.rs
[rust-reset]: https://github.com/rust-crdt/rust-crdt/blob/master/examples/reset_remove.rs
[akka]: https://doc.akka.io/libraries/akka-core/current/typed/distributed-data.html#maps
