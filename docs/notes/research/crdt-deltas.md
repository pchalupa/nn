# CRDT deltas

Research date: **2026-10-17**. Sources are first-party source code, official documentation and the published papers.

Versions and revisions inspected:

| What                                    | Pinned at                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Automerge (JS `@automerge/automerge`)   | **3.5.0**, repository commit `4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903`      |
| Yjs                                     | **13.6.33**, repository commit `9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c`    |
| Automerge binary format specification   | `automerge.org/automerge-binary-format-spec/`, read 2026-10-17               |
| Delta-state CRDT papers                 | arXiv `1410.2803v2`, `1603.01529v1` (JPDC 111, 2018), `1803.02750` (ICDE 2019) |
| Byzantine Eventual Consistency          | arXiv `2012.00472`, the paper the Automerge sync module cites                |
| Node.js used for the runtime checks     | **26.11.1**                                                                   |

Scope: how a replica works out what to send to another replica, and what the word "delta" means in each system. Opinion and recommendations are marked.

## Short answer

The word **delta** means three different things in this area, and most confusion comes from mixing them:

1. **A wire-level increment.** The bytes one replica sends another so the second catches up. In Automerge this is a set of *changes*; in Yjs it is an *update*. [Automerge sync message][am-sync-msg] [Yjs update API][y-updates]
2. **A delta-state in the formal sense.** A value in the same join-semilattice as the full state, produced by a delta mutator, joined into both the local and the remote state. This is the Almeida/Shoker/Baquero definition. Neither Automerge nor Yjs ships one. [δ-CRDT definitions][delta-jpdc]
3. **An editor delta.** The Quill-shaped `{retain, insert, delete}` list that describes a change to a text or list as positions. Yjs `YEvent.delta` and `Y.Text.toDelta` return this. Automerge's equivalent is its `Patch` list. [Yjs YEvent][y-yevent] [Automerge Patch][am-patch]

For the wire-level question, there are two working answers in production:

- **Automerge computes the increment from a hash-linked DAG of changes.** A change is identified by the SHA-256 of its encoded bytes, and it names its causal parents by hash. The current state of a document is its *heads*: the hashes with no successors. [Binary format spec][am-binary] [`Automerge::get_heads`][am-get-heads]
- **Yjs computes the increment from a state vector.** Every item has an ID `(client, clock)`, each client's clocks are contiguous, so `client -> next expected clock` is enough for a peer to say exactly what it has. [Yjs internals][y-internals] [`writeClientsStructs`][y-write-clients]

The practical difference: Yjs can answer "what am I missing" from a single small message, and Automerge generally cannot, because a set of hashes has no compact encoding that says "everything reachable from here". Automerge works around this with a Bloom filter of recent change hashes plus explicit `have`/`need` sets, and falls back to extra round trips. [`get_hashes_to_send`][am-hashes-to-send] [BEC §5.3][bec]

My recommendation for this repo is in [section 8](#8-synthesis-what-this-means-for-this-repo). In short: the entity model here is already shaped like a join-semilattice, so the delta-state framing fits it better than either Automerge's or Yjs's design, and the work that has to happen first is not about deltas at all.

## 1. What a "delta" actually is in Automerge

### Ops and changes

An **op** is one primitive mutation: set a map key, insert a list element, delete, increment a counter. Every op has an `OpId`, which is a pair of a counter and an actor index.

A **change** is a batch of ops committed together, plus metadata. Automerge never ships a single op; the change is the unit of transfer. The stored shape is:

```rust
pub(crate) struct Change<'a, O: OpReadState> {
    /// The raw bytes of the entire chunk containing this change, including the header.
    pub(crate) bytes: Cow<'a, [u8]>,
    pub(crate) header: Header,
    pub(crate) dependencies: Vec<ChangeHash>,
    pub(crate) actor: ActorId,
    pub(crate) other_actors: Vec<ActorId>,
    pub(crate) seq: u64,
    pub(crate) start_op: NonZeroU64,
    pub(crate) timestamp: i64,
    pub(crate) message: Option<String>,
    // …
}
```

[`storage/change.rs:44-61`][am-stored-change]

### `(actor, seq)` and `startOp`

**`seq`** counts changes by one actor, starting at 1 and with no gaps. `ChangeGraph::seq_for_actor` is literally the length of that actor's change list. [`change_graph.rs:216-221`][am-seq-for-actor]

Each actor's changes form a chain, because when a transaction opens, Automerge adds the actor's own previous change to the dependency set if the current heads do not already cover it:

```rust
seq = self.change_graph.seq_for_actor(actor_index) + 1;
deps = self.get_heads();
scope = None;
if seq > 1 {
    let last_hash = self.get_hash(actor_index, seq - 1).unwrap();
    if !deps.contains(&last_hash) {
        deps.push(last_hash);
    }
}
```

[`automerge.rs:546-557`][am-tx-args]

That chain is what makes the per-actor sequence comparison in [section 2](#2-how-the-difference-between-two-document-states-is-computed) correct: if an actor's change at `seq = n` is reachable, every earlier change by that actor is reachable too.

**`startOp`** is the counter of the first op in the change. It is taken from a document-wide maximum, not a per-actor one:

```rust
// SAFETY: this unwrap is safe as we always add 1
let start_op = NonZeroU64::new(self.change_graph.max_op() + 1).unwrap();
```

[`automerge.rs:566-567`][am-start-op]

Ops inside the change then get counters `startOp`, `startOp + 1`, and so on — `next_id()` returns `OpId::new(self.start_op.get() + self.pending_ops() as u64, self.actor)`. [`transaction/inner.rs:294-296`][am-next-id]

`startOp` is **not** unique across replicas. Two concurrent changes made from the same heads get the same `startOp`; uniqueness of an `OpId` comes from the actor half of the pair. I confirmed this in a runtime check: two sibling changes both reported `startOp: 6` ([section 9](#9-evidence-and-limits)).

### The change hash and the DAG

The change hash is defined by the binary format specification as "the SHA256 hash of the concatenation of the chunk type (0x01) chunk length and chunk contents fields of a change represented as a change chunk". [Binary format spec][am-binary] The implementation matches:

```rust
fn hash(typ: ChunkType, data: &[u8]) -> ChangeHash {
    let mut header = Vec::with_capacity(5);
    header.push(u8::from(typ));
    leb128::write::unsigned(&mut header, data.len() as u64).unwrap();
    let mut hasher = Sha256::new();
    hasher.update(&header);
    hasher.update(data);
    // …
}
```

[`storage/chunk.rs:302-312`][am-chunk-hash]

A change's `deps` are the hashes of its causal parents, sorted. [`ChangeBuilder::with_dependencies`][am-deps-sort] Changes therefore form a directed acyclic graph, and the document's *heads* are the nodes with no successors:

```rust
pub fn get_heads(&self) -> Vec<ChangeHash> {
    let mut deps: Vec<_> = self.deps.iter().copied().collect();
    deps.sort_unstable();
    deps
}
```

[`automerge.rs:1506-1510`][am-get-heads]

### Why content hashes rather than a version vector

The Automerge sync module says its protocol is "based on this paper: <https://arxiv.org/abs/2012.00472>". [`sync.rs:1-4`][am-sync-mod] That paper, Kleppmann and Howard's *Byzantine Eventual Consistency*, gives the reason directly: vector clocks are not safe when a replica can misbehave.

> However, vector clocks are not suitable in a Byzantine setting. The problem is illustrated in Figure 4, where faulty replica *q* generates two different messages, *A* and *B*, with the same vector timestamp (0, 1, 0). […] *p* and *r* detect that their vector timestamps are equal, and thus incorrectly believe that they are in the same state, even though their sets of messages are different. [BEC §4.3][bec]

A content hash cannot be forged into agreement the same way, because it commits to the bytes. Automerge takes the failure mode seriously even in the non-Byzantine case: when a local change claims an actor sequence number, it drops any queued change that claims the same or a later one from that actor, with the comment "retaining it would allow `save()` to encode duplicate sequence numbers". [`automerge.rs:560-564`][am-branch-drop] [`change_queue.rs:72-93`][am-branch-remove]

That is the semantic argument. Whether it is the *only* reason Automerge 2 chose hashes is not something I can source; the code and the cited paper support the Byzantine argument and nothing I read contradicts it.

### Columnar encoding: compression or semantics?

The binary format has three chunk types: `0x00` document, `0x01` change, `0x02` compressed change. Both document and change chunks store their contents as columns, and the specification is explicit about why: the format "assumes that the values of various fields are similar across adjacent changes and operations to optimize for high compression ratios and fast decoding". [Binary format spec][am-binary]

So the columnar layout is a compression and parsing concern — with one exception that matters. **The change hash is taken over the encoded bytes.** The encoding is therefore part of the change's identity, not just its size: two implementations that encode the same ops differently produce different hashes and will never agree they have the same change.

This matters more in 3.5.0 than it used to, because the document does not keep change bytes at all. `Automerge` holds a `ChangeGraph` of metadata, an `OpSet` of columnar ops, the heads, and a queue of causally unready changes:

```rust
pub struct Automerge {
    /// The list of unapplied changes that are not causally ready.
    pub(crate) queue: ChangeQueue,
    /// Graph of changes
    pub(crate) change_graph: ChangeGraph,
    authors: Authors,
    /// Current dependencies of this document (heads hashes).
    deps: HashSet<ChangeHash>,
    /// The set of operations that form this document.
    pub(crate) ops: OpSet,
    // …
}
```

[`automerge.rs:249-263`][am-struct]

Changes are **re-encoded on demand** from the op set plus the change graph, through `ChangeCollector`. [`op_set2/change/collector.rs:656-663`][am-exclude-hashes] The encoder has to be byte-for-byte deterministic or the hashes would not survive a save/load round trip. The code guards this with a debug assertion comparing the two reconstruction paths by hash. [`collector.rs:736-760`][am-from-build-meta]

## 2. How the difference between two document states is computed

### `getChanges(oldDoc, newDoc)` is not a two-document diff

The JavaScript function is three lines:

```ts
export function getChanges<T>(oldState: Doc<T>, newState: Doc<T>): Change[] {
  const n = _state(newState)
  return n.handle.getChanges(getHeads(oldState))
}
```

[`javascript/src/implementation.ts:1029-1032`][am-js-get-changes]

It only reads `oldDoc`'s heads. It never consults `oldDoc`'s graph. Everything else happens inside `newDoc`:

```rust
pub fn get_changes(&self, have_deps: &[ChangeHash]) -> Vec<Change> {
    ChangeCollector::exclude_hashes(&self.ops, &self.change_graph, have_deps)
}
```

[`automerge.rs:1512-1514`][am-get-changes]

which is:

```rust
pub(crate) fn get_build_metadata_clock(
    &self,
    have_deps: &[ChangeHash],
) -> Vec<BuildChangeMetadata<'_>> {
    let clock = self.seq_clock_for_heads(have_deps);
    let change_indexes = self.get_build_indexes(clock);
    self.get_build_metadata_for_indexes(change_indexes)
}
```

[`change_graph.rs:491-498`][am-build-meta-clock]

Three steps, and none of them is a hash set difference:

1. **Graph traversal to a clock.** `seq_clock_for_heads` walks ancestors from the given heads and records, per actor, the highest `seq` reached. The result is a `SeqClock`. [`change_graph.rs:808-830`][am-calc-clock]
2. **Per-actor suffix selection.** Every actor's changes are kept in insertion order, so "everything after seq *n*" is an array slice:

   ```rust
   fn get_build_indexes(&self, clock: SeqClock) -> Vec<NodeIdx> {
       let mut change_indexes: Vec<NodeIdx> = Vec::new();
       // walk the state from the given deps clock and add them into the vec
       for (actor_index, actor_changes) in self.seq_index.iter().enumerate() {
           if let Some(seq) = clock.get_for_actor(&actor_index) {
               change_indexes.extend(&actor_changes[seq.get() as usize..]);
           } else {
               change_indexes.extend(&actor_changes[..]);
           }
       }
       // …
   }
   ```

   [`change_graph.rs:457-474`][am-build-indexes]
3. **Re-encoding.** The selected changes are rebuilt from the op set.

So internally Automerge *does* reduce heads to a version vector and then does a per-actor comparison. It just derives that vector locally instead of receiving it.

**The sharp edge:** `heads_to_nodes` silently drops heads this document does not know.

```rust
fn heads_to_nodes<'a>(&self, heads: &'a [ChangeHash]) -> impl Iterator<Item = NodeIdx> + use<'a, '_> {
    heads.iter().filter_map(|h| self.nodes_by_hash.get(h)).copied()
}
```

[`change_graph.rs:784-792`][am-heads-to-nodes]

If `oldDoc` has diverged — it holds a change `newDoc` has never seen — the only head you passed resolves to nothing, the clock comes back empty, and you get *the entire document*. I measured this: two siblings forked from a shared two-change history, `getChanges(left, right)` returned 3 changes, not 1 ([section 9](#9-evidence-and-limits)). Treat `getChanges` as "what does `newDoc` have beyond this point in its own history", not as a symmetric difference.

### The rest of the family

| Function                      | What it actually does                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `getAllChanges(doc)`          | `doc.getChanges([])` — the empty clock selects every actor's whole list. [`implementation.ts:1041-1044`][am-js-get-all]                |
| `getChangesAdded(other)`      | A real hash-based DFS from `other`'s heads, stopping at changes `self` already has. This is what `merge` uses. [`automerge.rs:1532-1554`][am-changes-added] |
| `save()` / `save_with_options()` | One document chunk: columnar ops plus the whole change graph. [`automerge.rs:1148-1172`][am-save]                                       |
| `saveIncremental()`           | `save_after(save_cursor)` — the raw bytes of `get_changes(cursor)` concatenated, then the cursor moves to the current heads. [`autocommit.rs:589-596`][am-save-incremental] |
| `save_after(heads)`           | `for c in self.get_changes(heads) { bytes.extend(c.raw_bytes()) }`. Not a document chunk; a run of change chunks. [`automerge.rs:1194-1201`][am-save-after] |
| `loadIncremental(data)`       | Empty document: full load. Otherwise parse chunks into changes and `apply_changes_log_patches`. [`automerge.rs:1027-1068`][am-load-incremental] |
| `applyChanges(changes)`       | "This is idempotent in the sense that if a change has already been applied it will be ignored." Causally unready changes go into `queue`. [`automerge.rs:1092-1100`][am-apply-changes] |
| `getLastLocalChange()`        | Actor index, then `seq_for_actor`, then the hash at that seq, then rebuild. Stays local after remote changes are applied. [`automerge.rs:1223-1229`][am-last-local] |

Note the asymmetry between `getChanges` and `getChangesAdded`. The first is a clock comparison against a head set; the second is a graph walk against another in-memory document. `merge` uses the second because it has both documents. The sync protocol can only use something like the first, because the other replica is not in memory.

## 3. The sync protocol

### The message

```rust
pub struct Message {
    /// The heads of the sender.
    pub heads: Vec<ChangeHash>,
    /// The hashes of any changes that are being explicitly requested from the recipient.
    pub need: Vec<ChangeHash>,
    /// A summary of the changes that the sender already has.
    pub have: Vec<Have>,
    /// The changes for the recipient to apply.
    pub changes: ChunkList,
    pub flags: Option<MessageFlags>,
    pub version: MessageVersion,
}
```

[`sync.rs:529-547`][am-sync-msg]

```rust
/// A summary of the changes that the sender of the message already has.
/// This is implicitly a request to the recipient to send all changes that the
/// sender does not already have.
pub struct Have {
    /// The heads at the time of the last successful sync with this recipient.
    pub last_sync: Vec<ChangeHash>,
    /// A bloom filter summarising all of the changes that the sender of the message has added
    /// since the last sync.
    pub bloom: BloomFilter,
}
```

[`sync/state.rs:81-90`][am-have]

`State` is per peer and persistable. It carries `shared_heads` ("the hashes which we know both peers have"), `last_sent_heads`, `their_heads`, `their_need`, `their_have`, and `sent_hashes`. [`sync/state.rs:27-77`][am-sync-state]

### The Bloom filter

```rust
// These constants correspond to a 1% false positive rate. The values can be changed without
// breaking compatibility of the network protocol, since the parameters used for a particular
// Bloom filter are encoded in the wire format.
const BITS_PER_ENTRY: u32 = 10;
const NUM_PROBES: u32 = 7;
```

[`sync/bloom.rs:6-10`][am-bloom]

The filter covers only what the sender added *since the last sync with this peer*, not the whole document:

```rust
fn make_bloom_filter(&self, last_sync: Vec<ChangeHash>) -> Have {
    let hashes = self.change_graph.get_hashes(&last_sync);
    Have { last_sync, bloom: BloomFilter::from_hashes(hashes.iter()) }
}
```

[`sync.rs:310-316`][am-make-bloom]

The receiving side takes every hash it added since `last_sync`, keeps the ones that are **not** in the filter, then transitively adds everything that depends on them:

```rust
if bloom_filters.iter().all(|bloom| !bloom.contains_hash(hash)) {
    hashes_to_send.insert(*hash);
}
// …
let mut stack = hashes_to_send.iter().copied().collect::<Vec<_>>();
while let Some(hash) = stack.pop() {
    if let Some(deps) = dependents.get(&hash) {
        for dep in deps {
            if hashes_to_send.insert(*dep) { stack.push(*dep); }
        }
    }
}
```

[`sync.rs:318-380`][am-hashes-to-send]

This is the paper's Algorithm 2, line for line. The paper explains both halves:

> Any Bloom-negative messages are definitely unknown to the other replica, so we send those in reply. Moreover, we also send any successors of Bloom-negative messages […] since the set M for a correct replica cannot contain messages whose predecessors are missing, we know that these messages must also be missing from the other replica. [BEC §5.3][bec]

and the limitation:

> Due to Bloom filter false positives, the set of messages in the reply on line 13 may be incomplete, but it is likely to contain most of the messages that the other replica is lacking. To fill in the remaining missing messages we revert back to Algorithm 1, and perform round trips of needs requests and msgs responses until the received set of messages is complete. [BEC §5.3][bec]

That is why `need` exists. A false positive on a change with no Bloom-negative ancestor is omitted from the reply, the peer notices it still cannot reach the advertised heads, and asks for it explicitly. Automerge builds `need` from exactly that gap:

```rust
// Only request what we need to reach the peer's advertised heads. This is
// deliberately not `get_missing_deps`, which reports the missing dependencies of
// _every_ queued change […]
self.missing_deps_from(sync_state.their_heads.iter().flatten().copied())
```

[`sync.rs:170-181`][am-our-need]

### Why the protocol exists at all

Hash DAGs have no compact "everything you're missing" encoding. The paper rules out the two obvious alternatives before introducing Bloom filters: sending the whole message set is wasteful, and sending one hash per message "is still inefficient, as the message size is *O*(|M<sub>p</sub>|)". [BEC §4.2][bec]

Automerge adds one practical escape hatch the paper does not have. If the computed set is large relative to the document and the peer supports V2 messages, it gives up on the increment and sends the whole saved document instead:

```rust
if hashes.len() > self.change_graph.len() / 3 && sync_state.supports_v2_messages() {
    // sending more than a 1/3 of the document?  send everything
    let all_hashes = self.change_graph.get_hashes(&[]);
    MessageBuilder::new_v2(self.save(), all_hashes)
}
```

[`sync.rs:225-230`][am-third-rule]

A document chunk compresses far better than a run of change chunks, so past some ratio the "full state" is cheaper than the "delta". This is the same trade the delta-state anti-entropy algorithm makes when it falls back to shipping the whole state ([section 6](#6-delta-state-crdts-in-the-literature)).

## 4. Version vectors versus hash-based causal DAGs

| | Version vector / state vector | Hash-linked DAG |
| --- | --- | --- |
| "What do I have?" | One message, size *O*(replicas) | A set of heads, size *O*(concurrent branches) |
| "What am I missing?" | Derivable from the peer's vector alone | Not derivable; needs a probabilistic summary plus rounds |
| Identity of an event | `(replica, counter)` — assigned, not verified | Hash of the bytes — self-verifying |
| Two different events, same identity | Possible, and silently undetectable | Impossible under collision resistance |
| Cost that grows | With the number of replicas ever seen | With the number of events, and with branch count during sync |
| Needs a trusted replica identity | Yes | No |
| Deduplicates reordered or duplicated delivery | By counter comparison | By hash membership |

**Automerge keeps a clock anyway.** It is just never transmitted. `Clock` carries the doc comment:

```rust
/// A [`Clock`] is a vector clock for a set of actors.
///
/// Each index of the vector represents that actors counter.
pub(crate) struct Clock(pub(crate) Vec<u32>);
```

[`clock.rs:5-12`][am-clock]

Three uses, all derived from heads by graph traversal:

- `SeqClock` in `get_changes`, as traced in [section 2](#2-how-the-difference-between-two-document-states-is-computed).
- `clock_at(heads)` for reading the document as of a past point. [`change_graph.rs:794-805`][am-clock-at]
- `ClockRange::Diff(before, after)` for `diff`, covered in [section 7](#7-application-level-patches). [`automerge.rs:1230-1234`][am-clock-range]

Opinion: the split is the interesting part. Automerge uses hashes on the wire, where trust and divergence matter, and a vector clock internally, where it already knows the graph is well-formed and wants cheap range queries. Reading these as competing designs misses that they answer different questions — the hash answers "is this the same event", the clock answers "is this event in that prefix".

## 5. Yjs by contrast

### Struct store, item IDs, delete set

Every item carries an ID, and the clock is described as continuous per client:

```js
export class ID {
  /**
   * @param {number} client client id
   * @param {number} clock unique per client id, continuous number
   */
  constructor (client, clock) { /* … */ }
}
```

[`src/utils/ID.js:7-24`][y-id]

The struct store keeps one array per client, in clock order. [`src/utils/StructStore.js:10-25`][y-struct-store]

Deletions are handled completely differently, and the internals document is blunt about it:

> Deletions in Yjs are treated very differently from insertions. Insertions are implemented as a sequential operation based CRDT, but deletions are treated as a simpler state based CRDT.
>
> […] No data is kept on *when* an item was deleted, or which user deleted it. The struct store does not contain deletion records. The clientID's clock is not incremented. [Yjs internals, Deletions][y-internals]

I verified the last line: inserting three items took the state vector from nothing to `clock 3`, and deleting one left it at `clock 3` ([section 9](#9-evidence-and-limits)).

### State vector in, update out

```js
export const writeStateVector = (encoder, sv) => {
  encoding.writeVarUint(encoder.restEncoder, sv.size)
  array.from(sv.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
    encoding.writeVarUint(encoder.restEncoder, client)
    encoding.writeVarUint(encoder.restEncoder, clock)
  })
  return encoder
}
```

[`src/utils/encoding.js:601-608`][y-write-sv]

`encodeStateAsUpdate(doc, stateVector)` filters the struct store by that vector and then appends the delete set:

```js
export const writeStateAsUpdate = (encoder, doc, targetStateVector = new Map()) => {
  writeClientsStructs(encoder, doc.store, targetStateVector)
  writeDeleteSet(encoder, createDeleteSetFromStructStore(doc.store))
}
```

[`src/utils/encoding.js:504-507`][y-write-state]

The filter is a per-client comparison, exactly like Automerge's `get_build_indexes` — the difference is that the input vector arrived over the network instead of being derived locally:

```js
export const writeClientsStructs = (encoder, store, _sm) => {
  const sm = new Map()
  _sm.forEach((clock, client) => {
    // only write if new structs are available
    if (getState(store, client) > clock) { sm.set(client, clock) }
  })
  getStateVector(store).forEach((_clock, client) => {
    if (!_sm.has(client)) { sm.set(client, 0) }
  })
  // …
}
```

[`src/utils/encoding.js:81-101`][y-write-clients]

`Y.diffUpdate(update, sv)` applies the same filter to an already-encoded update rather than to a live document. [`src/utils/updates.js:467-507`][y-diff-update] The documentation says the same: "This function works similarly to `Y.encodeStateAsUpdate(ydoc, stateVector)` but works on updates instead." [Yjs update API][y-updates]

### Why Yjs can and Automerge generally can't

Three properties have to hold together, and Yjs has all three:

1. Each item ID is `(client, clock)` with per-client contiguous clocks, so a single integer per client describes a complete prefix.
2. Integration does not need causal dependency hashes. An update that references items you lack is parked in `store.pendingStructs` with a `missing` map and retried when the gap fills. [`src/utils/encoding.js:396-416`][y-pending]
3. A client ID is assumed unique and non-reused. [Yjs internals, Network protocol][y-internals]

Automerge gives up (3) on purpose ([section 1](#1-what-a-delta-actually-is-in-automerge)), and its changes carry explicit `deps` hashes, so a peer's claim about `(actor, seq)` is not by itself enough to decide what to send.

**But the state vector is not free, and Yjs pays for it in the delete set.** Because deletions never advance a clock, they are outside the state vector entirely, and `writeStateAsUpdate` re-sends the whole delete set on every update regardless of the target vector. `diffUpdateV2` likewise copies the delete set straight through. In the common case this is cheap, because deletions come in runs and the delete set stores runs. [Yjs internals, Deletions][y-internals] When they do not, it is not: in my runtime check, deleting every other character of a 4000-character document produced a **5,945-byte update for a peer that was already completely up to date** ([section 9](#9-evidence-and-limits)).

### Two meanings of "delta" in Yjs

This is the ambiguity that causes most of the confusion, so to be explicit:

| Term                                         | What it is                                                          | Shape                                                           |
| -------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **update** (`encodeStateAsUpdate`, `diffUpdate`) | The replication increment                                            | Binary: structs with `(client, clock)` IDs plus a delete set     |
| **delta** (`YEvent.delta`, `Y.Text.toDelta`) | A description of a change by position, for editors and UI            | `[{retain: 5}, {insert: " world"}]` — the Quill delta convention |

They are not convertible. The first addresses stable item identities; the second addresses positions in the current view. `YEvent.delta` is documented as computable only during the event call. [`src/utils/YEvent.js:140-150`][y-yevent] The Yjs update documentation never uses the word "delta" at all. [Yjs update API][y-updates]

## 6. Delta-state CRDTs in the literature

### The definitions

From Almeida, Shoker and Baquero. I read the arXiv version `1603.01529`, which is the paper published as *Delta State Replicated Data Types*, JPDC 111 (2018) 162–173; the earlier `1410.2803` (*Efficient State-based CRDTs by Delta-Mutation*) carries the same core definitions.

**Delta mutator.** "A delta-mutator *m*<sup>δ</sup> is a function, corresponding to an update operation, which takes a state *X* in a join-semilattice *S* as parameter and returns a delta-mutation *m*<sup>δ</sup>(*X*), also in *S*." [Definition 1][delta-jpdc]

The point of "also in *S*" is that a delta is not a separate operation language. It is an ordinary state value, just a small one, and it is applied by the same join as everything else.

**Delta-group.** "A delta-group is inductively defined as either a delta-mutation or a join of several delta-groups." [Definition 2][delta-jpdc] Local deltas accumulate into a buffer, and "a full state can be seen as a special (extreme) case of a delta-group".

**δ-CRDT.** A triple (*S*, *M*<sup>δ</sup>, *Q*) where every transition is either `X' = X ⊔ m^δ(X)` or `X' = X ⊔ D`. [Definition 3][delta-jpdc] Even local writes go through the join.

**Delta-state decomposition.** A δ-CRDT decomposes a state-based CRDT if `m(X) = X ⊔ m^δ(X)` for every mutator, and it is useful when `size(m^δ(X)) ≪ size(m(X))`. [§4.1][delta-jpdc]

**Delta-interval.** Given a replica progressing through states *X*<sup>0</sup>, *X*<sup>1</sup>, …, "a delta-interval Δ<sup>a,b</sup> is a delta-group resulting from joining deltas *d*<sup>a</sup>, …, *d*<sup>b−1</sup>". [Definition 4][delta-jpdc] Contiguous, from one replica's own progression.

**Causal delta-merging condition.** An algorithm satisfies it if it "only joins Δ<sup>a,b</sup><sub>j</sub> from replica *j* into state *X*<sub>i</sub> of replica *i* that satisfy *X*<sub>i</sub> ⊒ *X*<sup>a</sup><sub>j</sub>" — the receiver must already subsume the state the first delta of the interval was joined into. [Definition 6][delta-jpdc] Proposition 2 proves that an algorithm meeting this reaches exactly the states a full-state CRDT would, which is where causal consistency comes from.

**Join-irreducible state** and **join decomposition** are *not* from these two papers. They were brought to state-based CRDTs by Enes, Almeida, Baquero and Leitão, *Efficient Synchronization of State-based CRDTs* (ICDE 2019):

- A state *x* is **join-irreducible** if "it cannot result from the join of any finite set of states *F* ⊆ *L* not containing *x*". Bottom is never join-irreducible. [Definition 1][enes]
- A set of join-irreducibles *D* is a **join decomposition** of *x* if `⨆D = x`. [Definition 2][enes]
- It is **irredundant** if no proper subset joins to the same value, and by Birkhoff's representation theorem the irredundant decomposition is unique: `⇓x = max{r ∈ J(L) | r ⊑ x}`. [Definition 3, §III-A][enes]
- That gives the minimum difference between two states: `Δ(a,b) = ⨆{y ∈ ⇓a | y ⋢ b}`, which is optimal in the sense that any *c* with `c ⊔ b = a ⊔ b` satisfies `Δ(a,b) ⊑ c`. [§III-B][enes]

### Why naive delta shipping breaks

Enes et al. identify two sources of waste that make the classic algorithm perform "no better than state-based":

1. **Back-propagation.** A replica joins a received delta-group into its own buffer and then ships it back toward the replica it came from. Fixed by tracking the origin of each group (BP).
2. **Redundant re-propagation.** A received delta-group may partly duplicate what is already in the buffer, so forwarding it re-sends state the neighbours already got. Fixed by removing redundant state from received groups before buffering (RR), which is exactly what a join decomposition lets you compute. [§II-B][enes]

> Note that as long as this pattern keeps repeating (i.e. there's always a state change between synchronizations), delta-based synchronization will propagate the same amount of state as state-based synchronization would, representing no improvement. [§II-B][enes]

### What the anti-entropy algorithm adds

Algorithm 2 of the JPDC paper is the minimum machinery for correctness, and it is more than "send the small thing":

- A **durable** sequence counter `c_i`, incremented every time any delta is joined into the local state — including received ones.
- A buffer `D_i` mapping sequence numbers to deltas, giving contiguous intervals.
- An **ack map** `A_i`, per neighbour, holding the largest interval end that neighbour has acknowledged.
- Send `⨆{D_i(l) | A_i(j) ≤ l < c_i}` to neighbour *j* — exactly the interval it has not acked.
- Fall back to the **full state** when the buffer is empty, or when the neighbour is expecting a delta that has already been garbage collected.
- Garbage collect deltas acked by all neighbours.

The paper is specific about why the counter must be durable: "Otherwise, there would be the danger of receiving some delayed ack, for a delta-interval sent before crashing, causing the node to skip sending some deltas generated after recovery, thus violating the delta-merging condition." [§6.1][delta-jpdc]

### Are Automerge and Yjs delta-state CRDTs?

**No, neither of them.** Both are operation-based.

| | δ-CRDT (formal) | Automerge | Yjs |
| --- | --- | --- | --- |
| Increment is a value in the same lattice as the state | Yes, by definition | No — a change is a batch of ops with metadata | Partly: an update is structs plus a delete set |
| Applied by join | Yes, including local writes | No — ops are integrated into an op set | No — structs are integrated into the struct store |
| Needs causal delivery | No, if only eventual convergence is wanted | Yes — changes name their `deps` and queue if unready | Effectively yes — missing structs park in `pendingStructs` |
| Increment is idempotent, commutative, associative | Yes (lattice join) | Idempotent via hash membership | Documented as all three [Yjs update API][y-updates] |
| Anti-entropy needs per-peer state | Ack map | `sync::State` per peer | State vector exchange per round |

The closest Yjs comes is its deletion handling, which it describes itself as "a simpler state based CRDT". [Yjs internals][y-internals] The delete set is a join-semilattice value — union of per-client clock ranges — and merging two of them is a join. That is also why it is re-sent whole: the system has no decomposition of it against a peer's known state.

Automerge's position is cleaner: changes are op-based with explicit causal dependencies, the sync protocol is a reconciliation over a hash DAG, and nothing in it is a lattice join.

## 7. Application-level patches

### Automerge

A `Patch` is a path plus an action:

```rust
pub struct Patch {
    /// The object this patch modifies
    pub obj: ObjId,
    /// The path to the property in the parent object where this object lives
    pub path: Vec<(ObjId, Prop)>,
    /// The change this patch represents
    pub action: PatchAction,
}
```

[`patches/patch.rs:17-24`][am-patch] with actions `PutMap`, `PutSeq`, `Insert`, `SpliceText`, `Increment`, `Conflict`, `DeleteMap`, `DeleteSeq`, `Mark`. [`patches/patch.rs:32-89`][am-patch-action]

Patches come from a `PatchLog`, which every mutating entry point can be given: `change`, `applyChanges`, `loadIncremental`, `receiveSyncMessage`, `merge`. The JS callback signature is:

```ts
export type PatchCallback<T> = (
  patches: Array<Patch>,
  info: PatchInfo<T>,
) => void
```

[`javascript/src/types.ts:54-57`][am-patch-callback] where `PatchInfo` carries `before`, `after` and a `source` tag naming which entry point produced them.

`diff(doc, before, after)` does **not** replay changes. It builds a pair of vector clocks and compares op visibility under them:

```rust
pub fn diff(&self, before_heads: &[ChangeHash], after_heads: &[ChangeHash]) -> Vec<Patch> {
    let clock = self.clock_range(before_heads, after_heads);
    let mut patch_log = PatchLog::active();
    DiffIter::log(self, ObjMeta::root(), clock, &mut patch_log, true);
    patch_log.heads = Some(after_heads.to_vec());
    patch_log.make_patches(self)
}
```

[`automerge.rs:1420-1426`][am-diff]

`clock_range` is `ClockRange::Diff(clock_at(before), clock_at(after))`, and `ClockRange` exposes `visible_after(op)` and `predates(op)`. [`clock.rs:75-116`][am-clock-range-impl] An op is an insert if it is visible after and not before, a delete if the reverse. Because the two clocks are symmetric, the arguments can be reversed and you get the inverse patch set. The docs say so — "Note: `before_heads` and `after_heads` do not have to be chronological. Document state can move backward" [`automerge.rs:1442-1443`][am-diff-obj] — and I verified it ([section 9](#9-evidence-and-limits)).

`applyPatch` / `applyPatches` go the other way: they take a patch list and mutate a plain JavaScript value, or an Automerge draft inside `change`. [`javascript/src/apply_patches.ts`][am-apply-patches]

`updateText` is a third thing again, and worth separating clearly. It is a **value diff producing operations**:

> This will calculate a diff between the current value and the new value and then convert that diff into calls to {@link splice}. This will produce results which don't merge as well as directly capturing the user input actions, but sometimes it's not possible to capture user input and this is the best you can do. [`implementation.ts:1565-1583`][am-update-text]

The implementation is a Myers diff. [`rust/automerge/src/text_diff.rs:15`][am-myers] The warning in that doc comment is the whole story: a reconstructed diff is not the user's intent, and it merges worse.

### Yjs

`YEvent.delta` is the same idea in Quill's vocabulary, computed by walking the type's items and classifying each against the transaction's `beforeState`:

```js
adds (struct) {
  return struct.id.clock >= (this.transaction.beforeState.get(struct.id.client) || 0)
}
```

[`src/utils/YEvent.js:160-162`][y-adds]

Note what the comparison is: a `(client, clock)` test against a state vector snapshot. The identity-level machinery is right there; `delta` is what you get after projecting it onto positions.

### The distinction that matters

| | Wire-level delta | Application patch |
| --- | --- | --- |
| Addresses | Stable identities: `(actor, counter)` or `(client, clock)` | Positions and paths in the current view |
| Survives concurrency | Yes, that is the point | No — an index is only meaningful for one state |
| Direction | Produces state | Describes state that already changed |
| Automerge | `Change` / sync message | `Patch`, from `PatchLog` or `diff` |
| Yjs | update bytes | `YEvent.delta`, `Y.Text.toDelta` |

Sending patches instead of changes across the network loses the merge. That is exactly the trade `updateText` documents and accepts when there is no other option.

## 8. Synthesis: what this means for this repo

**Everything in this section is opinion and recommendation, not something a source guarantees.**

### Where the repo currently stands

Sync is state-based: replicas exchange values and converge by calling `Entity.merge` on each root. [ADR-12][adr12] The entity layer is a register, a map and a keyed list:

- `LWWRegister.merge` picks the side with the greater `Time`. [`LWWRegister.ts`][repo-register]
- `LWWMap.merge` merges field by field, so each field keeps its own winner. [`LWWMap.ts`][repo-map]
- `RGA.merge` is a key union: shared keys merge through the row's own `merge`, unseen keys append. [ADR-11][adr11] [`RGA.ts`][repo-rga]
- `Time` is a hybrid logical clock carrying a replica identity, and ordering is total. [ADR-09][adr09]
- Persistence writes a complete record per root, as a tree of register, map and collection entries. [ADR-12][adr12]

### Which strategy fits

| Strategy | Fit here | What it would cost |
| --- | --- | --- |
| Ship the whole root record | Already how persistence works; no new concepts | Bandwidth grows with the root, not the edit. Fine for a board, wrong for a long collection |
| **Delta-state (δ-CRDT) with delta intervals** | **Best fit.** Merge is already a join and already recursive over the entity tree | A per-replica durable counter, a delta buffer, a per-peer ack map, and a correct `Entity.delta()` per entity kind |
| Op log with causal dependency hashes (Automerge-shaped) | Poor fit | Replaces the whole entity model with an op model, a change encoder, a hash DAG and a reconciliation protocol |
| State vector plus per-replica op ranges (Yjs-shaped) | Poor fit for the same reason | Needs per-replica contiguous counters on every operation, which `Time` does not provide and is not for |

My recommendation is the delta-state route, because it is the only one that keeps the entity model. The shape would be `Entity.delta(since)` returning an entity of the same class holding only the parts that changed, so the receiver applies it with the existing `merge`. That is Definition 1 almost literally: a value in the same semilattice, applied by the same join. [δ-CRDT Definition 1][delta-jpdc]

The optimal version of that method is `Δ(a, b) = ⨆{y ∈ ⇓a | y ⋢ b}` over the irredundant join decomposition. [Enes §III-B][enes] For these three types the decomposition is trivial and does not need the general theory:

- A register decomposes to itself. Its delta is either the whole register or nothing.
- A map decomposes to one singleton per field. Its delta is the fields whose child delta is non-empty.
- A keyed list decomposes to one singleton per key. Its delta is the rows that changed, plus the removals once removals exist.

### What has to happen first

Three things, and none of them is about deltas:

1. **Removal has to be representable.** `RGA.merge` "does not remove rows, because without tombstones a replica cannot tell a key its peer removed from a key its peer never had". [ADR-11][adr11] A delta cannot express a removal the full state cannot express either. Deltas do not create this problem and will not solve it.
2. **`merge` has to be a real join.** `LWWMap.merge` iterates `this.fields` and only merges keys it already has, so a field present only on the remote is dropped. Under ADR-12 both sides build the same fields from the same schema, so this does not bite today — but a delta carrying a field the receiver has not materialised is precisely the case that breaks it. Same question for `LWWRegister.merge`, which writes into the remote instance as well as the local one.
3. **The anti-entropy state has to be durable.** The JPDC paper is explicit that the delta sequence counter must survive a crash, or a delayed ack can cause a replica to skip deltas and silently violate the causal delta-merging condition. [§6.1][delta-jpdc] Persistence here currently writes CRDT state per root; an ack map and a counter are a different kind of record with a different lifetime.

### What I would not copy

- **The Bloom filter.** It exists because Automerge cannot name what a peer is missing. If entities carry a per-replica sequence number, a peer can. Do not import the probabilistic summary and the extra round trips to solve a problem this design would not have.
- **Content-hashed events.** The Byzantine argument is real but it is about untrusted peers. [BEC §4.3][bec] Until this library has that threat model, hashes buy divergence detection at the price of the entire op model.
- **Automerge's `getChanges(oldDoc, newDoc)` signature.** It reads as a two-document diff and is not one; a diverged first argument silently degrades to sending everything ([section 2](#2-how-the-difference-between-two-document-states-is-computed)). If this repo ever grows a similar function, name it after what it does.

## 9. Evidence and limits

This is a source-based study with small runtime checks. It is not a benchmark and not a correctness proof. Documentation and source links are pinned to the commits in the header; documentation pages are not version-pinned and were read on 2026-10-17.

What I could **not** verify against a primary source:

- The claim that Automerge 2's choice of content hashes was driven *primarily* by the Byzantine argument. The sync module cites the BEC paper and the code defends against duplicate `(actor, seq)` branches, which supports the argument, but I found no first-party statement of the decision rationale. The Automerge 2.0 announcement does not discuss hashes or version vectors at all. [Automerge 2.0][am-blog]
- `automerge.org/docs/reference/under-the-hood/binary_format/` and `.../sync/` both return 404. The binary format content lives at the separate specification site; the sync protocol has no prose documentation page I could find, so section 3 is grounded in the module documentation, the source and the cited paper.
- The JPDC 2018 published text. I read arXiv `1603.01529`; the DOI version is paywalled and may differ in wording.
- Enes et al. Appendices A–C, which contain the uniqueness proofs and the generic decomposition rules. I read the main body and Definitions 1–3 only.
- Automerge's V2 "send everything over a third" heuristic is read from the source. I did not measure where the crossover actually sits.

### Runtime spot checks, 2026-10-17

Original observations, `@automerge/automerge@3.5.0` and `yjs@13.6.33` under Node.js 26.11.1. These test specific histories, not every schedule.

**Automerge: `getChanges` is one-directional.** Starting from a document with two changes, cloned into `left` and `right`, each making one more change:

```text
heads(left)                   [4f8a70f4…]
heads(right)                  [f112f5a2…]
getChanges(left, right).len   3        <- not 1
getChanges(right, left).len   3        <- not 1
heads(merged)                 [4f8a70f4…, f112f5a2…]
getChanges(left, merged).len  1
getAllChanges(merged).len     4
```

`left`'s head is not in `right`'s graph, so `heads_to_nodes` drops it, the clock comes back empty and every change is selected. After merging, `left`'s head resolves and the answer is 1.

**Automerge: `startOp` is not unique across concurrent changes.** The four changes of the merged document:

| actor prefix | seq | startOp | ops | deps |
| ------------ | --- | ------- | --- | ---- |
| `06562d`     | 1   | 1       | 3   | 0    |
| `06562d`     | 2   | 4       | 2   | 1    |
| `bcb90f`     | 1   | 6       | 2   | 1    |
| `c2c69e`     | 1   | 6       | 2   | 1    |

Both concurrent changes claim `startOp: 6`. Uniqueness of an `OpId` comes from the actor half.

**Automerge: `saveIncremental` is relative to the last save, and is empty when nothing changed.**

```text
save() bytes                                152
saveIncremental() after one change           101
saveIncremental() again, no change             0
```

**Automerge: `diff` is reversible.** For a document going from `{n: 1, tags: {a: true}}` to `{n: 2, tags: {a: true, b: true}}`:

```text
diff(doc, before, after)  [{"action":"put","path":["n"],"value":2},
                           {"action":"put","path":["tags","b"],"value":true}]
diff(doc, after, before)  [{"action":"put","path":["n"],"value":1},
                           {"action":"del","path":["tags","b"]}]
```

This follows from `diff` comparing op visibility under two clocks rather than replaying changes.

**Automerge: `getLastLocalChange` stays local.** After applying a remote change from a clone, `getLastLocalChange` still returned the local actor's `seq: 2`, not the newly applied remote change.

**Yjs: deletions do not advance the state vector.**

```text
after inserting 3 items   [[3428260041, 3]]
after deleting 1 item     [[3428260041, 3]]
```

**Yjs: the delete set is re-sent in full.** A 4000-character text with every other character deleted (2000 non-contiguous runs), synced to a second document until identical:

```text
state vector of the peer                             8 bytes
update computed for that fully up-to-date peer   5,945 bytes
after one more single-character insert           5,968 bytes
full state update                               43,836 bytes
```

With contiguous deletions instead — 500 characters deleted one at a time from position 0 — the same measurement gives **11 bytes**, because the delete set collapses to one run. This matches the internals document's claim that run-structured deletions keep the set tiny, and shows what happens when they are not.

**Yjs: `YEvent.delta` is positional.** Inserting `" world"` at index 5 and then deleting index 0 of `"hello"`:

```text
YEvent.delta  [{"retain":5},{"insert":" world"}]
YEvent.delta  [{"delete":1}]
toDelta()     [{"insert":"ello world"}]
```

**Yjs: `diffUpdate(update, sv)` and `encodeStateAsUpdate(doc, sv)` agreed in size** (28 bytes each) for the same document and target vector, consistent with them running the same filter over different inputs.

Reproduction: install `@automerge/automerge@3.5.0` and `yjs@13.6.33`. For Automerge, use `from`, two `clone` calls, `change`, then `getChanges` / `getAllChanges` / `decodeChange` / `diff` / `saveIncremental`. For Yjs, build two `Y.Doc`s, sync one with `encodeStateAsUpdate` + `applyUpdate`, then compare `encodeStateAsUpdate(a, encodeStateVector(b)).length` against `encodeStateAsUpdate(a).length`.

## Primary sources

### Automerge

Repository pinned at `4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903`, the `gitHead` recorded by npm for `@automerge/automerge@3.5.0`.

- Rust core: [`automerge.rs`][am-get-changes], [`change_graph.rs`][am-build-indexes], [`clock.rs`][am-clock], [`sync.rs`][am-sync-msg], [`sync/bloom.rs`][am-bloom], [`sync/state.rs`][am-have], [`storage/chunk.rs`][am-chunk-hash], [`storage/change.rs`][am-stored-change], [`patches/patch.rs`][am-patch], [`transaction/inner.rs`][am-next-id], [`change_queue.rs`][am-branch-remove], [`op_set2/change/collector.rs`][am-exclude-hashes].
- JavaScript: [`implementation.ts`][am-js-get-changes], [`types.ts`][am-patch-callback], [`apply_patches.ts`][am-apply-patches].
- Official documentation: [binary format specification][am-binary], [storage model][am-storage], [merge rules][am-merge], [Automerge 2.0 announcement][am-blog].

### Yjs

Repository pinned at `9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c` (tag `v13.6.33`).

- Source: [`encoding.js`][y-write-state], [`updates.js`][y-diff-update], [`ID.js`][y-id], [`StructStore.js`][y-struct-store], [`DeleteSet.js`][y-delete-set], [`YEvent.js`][y-yevent].
- [`INTERNALS.md`][y-internals] at the same commit, and the official [document update API][y-updates].

### Papers

- Almeida, Shoker, Baquero, *Efficient State-based CRDTs by Delta-Mutation*, arXiv [1410.2803v2][delta-2014].
- Almeida, Shoker, Baquero, *Delta State Replicated Data Types*, arXiv [1603.01529][delta-jpdc]; published in JPDC 111 (2018) 162–173, [doi:10.1016/j.jpdc.2017.08.003][delta-doi]. Definitions 1–6 and Algorithm 2 are cited from the arXiv version.
- Enes, Almeida, Baquero, Leitão, *Efficient Synchronization of State-based CRDTs*, ICDE 2019, arXiv [1803.02750][enes]. Source for join-irreducible states, join decomposition and optimal deltas.
- Kleppmann, Howard, *Byzantine Eventual Consistency and the Fundamental Limits of Peer-to-Peer Databases*, arXiv [2012.00472][bec]. The paper the Automerge sync module cites; §4.2, §4.3 and §5.3 are the relevant sections.

### Repository sources

Working tree inspected on 2026-10-17. Related notes: [Array-like CRDTs](array-like-crdts.md), [Persisting CRDT metadata](crdt-metadata-persistence.md), [Hybrid Logical Clocks](hybrid-logical-clocks.md).

[am-stored-change]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/storage/change.rs#L44-L61
[am-seq-for-actor]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L216-L221
[am-tx-args]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L546-L557
[am-start-op]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L566-L567
[am-next-id]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/transaction/inner.rs#L294-L296
[am-chunk-hash]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/storage/chunk.rs#L302-L312
[am-deps-sort]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/storage/change.rs#L343-L350
[am-get-heads]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1506-L1510
[am-sync-mod]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L1-L22
[am-branch-drop]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L560-L564
[am-branch-remove]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_queue.rs#L72-L93
[am-struct]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L249-L263
[am-exclude-hashes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/op_set2/change/collector.rs#L656-L663
[am-from-build-meta]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/op_set2/change/collector.rs#L736-L760
[am-js-get-changes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/javascript/src/implementation.ts#L1029-L1032
[am-get-changes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1512-L1514
[am-build-meta-clock]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L491-L498
[am-calc-clock]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L808-L830
[am-build-indexes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L457-L474
[am-heads-to-nodes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L784-L792
[am-js-get-all]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/javascript/src/implementation.ts#L1041-L1044
[am-changes-added]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1532-L1554
[am-save]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1148-L1172
[am-save-incremental]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/autocommit.rs#L583-L596
[am-save-after]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1188-L1201
[am-load-incremental]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1021-L1068
[am-apply-changes]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1092-L1100
[am-last-local]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1222-L1229
[am-sync-msg]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L529-L547
[am-have]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync/state.rs#L81-L90
[am-sync-state]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync/state.rs#L27-L77
[am-bloom]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync/bloom.rs#L6-L10
[am-make-bloom]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L310-L316
[am-hashes-to-send]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L318-L380
[am-our-need]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L170-L181
[am-third-rule]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/sync.rs#L219-L232
[am-clock]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/clock.rs#L5-L12
[am-clock-at]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/change_graph.rs#L794-L805
[am-clock-range]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1230-L1234
[am-clock-range-impl]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/clock.rs#L75-L116
[am-patch]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/patches/patch.rs#L11-L24
[am-patch-action]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/patches/patch.rs#L32-L89
[am-patch-callback]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/javascript/src/types.ts#L48-L57
[am-diff]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1420-L1426
[am-diff-obj]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/automerge.rs#L1428-L1452
[am-apply-patches]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/javascript/src/apply_patches.ts
[am-update-text]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/javascript/src/implementation.ts#L1565-L1597
[am-myers]: https://github.com/automerge/automerge/blob/4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903/rust/automerge/src/text_diff.rs#L15-L59
[am-binary]: https://automerge.org/automerge-binary-format-spec/
[am-storage]: https://automerge.org/docs/reference/under-the-hood/storage/
[am-merge]: https://automerge.org/docs/reference/under-the-hood/merge-rules/
[am-blog]: https://automerge.org/blog/automerge-2/
[y-id]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/ID.js#L7-L24
[y-struct-store]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/StructStore.js#L10-L25
[y-write-sv]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/encoding.js#L601-L608
[y-write-state]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/encoding.js#L504-L507
[y-write-clients]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/encoding.js#L81-L101
[y-diff-update]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/updates.js#L467-L507
[y-pending]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/encoding.js#L396-L416
[y-delete-set]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/DeleteSet.js#L188-L213
[y-yevent]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/YEvent.js#L140-L190
[y-adds]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/utils/YEvent.js#L160-L162
[y-internals]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/INTERNALS.md
[y-updates]: https://docs.yjs.dev/api/document-updates
[delta-2014]: https://arxiv.org/abs/1410.2803
[delta-jpdc]: https://arxiv.org/abs/1603.01529
[delta-doi]: https://doi.org/10.1016/j.jpdc.2017.08.003
[enes]: https://arxiv.org/abs/1803.02750
[bec]: https://arxiv.org/abs/2012.00472
[adr09]: ../../decisions/ADR-09-stamp-times-with-a-replica-identity.md
[adr11]: ../../decisions/ADR-11-defer-the-ordering-crdt.md
[adr12]: ../../decisions/ADR-12-store-rows-as-field-entities.md
[repo-register]: ../../../packages/entities/src/LWWRegister.ts
[repo-map]: ../../../packages/entities/src/LWWMap.ts
[repo-rga]: ../../../packages/entities/src/RGA.ts
