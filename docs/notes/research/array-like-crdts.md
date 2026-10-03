# Array-like CRDTs

Research date: **2026-09-28** (primary sources, package versions, and runtime spot checks).
Scope: variable-length ordered sequences, including arrays of objects and text.

## Short answer

The term to look for is **sequence CRDT** or **list CRDT**. It gives an array-like interface while replicas edit independently and later converge. Internally, operations address stable element identities or positions, because integer indices change as other elements are inserted and deleted. [RGA specification][rga] [Automerge merge rules][am-merge]

For an application, I would start with **Yjs `Y.Array`**, **Automerge lists**, or **Loro `MovableList`**, depending on the required operations. For understanding the algorithms, start with **RGA**, then compare **Logoot/LSEQ** and **Fugue/FugueMax**. These are recommendations, not a performance ranking.

The main design decision is whether the application needs only insertion/deletion, or also identity-preserving updates and moves. A move implemented as delete plus insert can create duplicates under concurrent moves. [Loro list semantics][loro-list] [List-move paper abstract][move]

Here, **concurrent** means neither edit had seen the other when it was created. **Interleaving** means independently inserted runs get mixed together, such as merging `abc` and `XYZ` into `aXbYcZ`. Replicas can agree on that result, so convergence alone does not prevent it. [Fugue §§II, V-A][fugue]

## 1. What makes a replicated array different?

Suppose both replicas start with `[A, B, C]`:

```text
Replica 1: insert X at index 0  -> [X, A, B, C]
Replica 2: delete index 1      -> [A, C]
```

Replaying “delete index 1” against replica 1 would delete `A`, although replica 2 meant `B`. A sequence CRDT resolves the local index to `B`'s stable identity before sending the operation. The merged result is `[X, A, C]`. This example follows the documented ID-based deletion semantics. [Automerge merge rules][am-merge]

An **element** is one occurrence in the sequence, not its value. Two entries containing `"hello"` have separate identities. Typical IDs combine a replica identifier and a counter; the exact ordering requirements vary by algorithm. RGA needs causality-compatible ID ordering, whereas Fugue allows arbitrary unique IDs with a deterministic total order. [RGA §6.1][rga] [Fugue §IV][fugue]

Keep these three concepts separate:

- **Element identity:** which occurrence an edit targets.
- **Sequence position:** where that occurrence appears relative to other elements.
- **Visible index:** its current zero-based offset in one replica's view.

This distinction is explicit in Automerge's merge rules and in Yjs's conversion from document offsets to item IDs. [Automerge][am-merge] [Yjs internals][y-internals]

### Fixed-length arrays are a simpler case

If slots never shift, model each slot as an independent register keyed by its index. A **register** holds one logical value; a last-writer-wins register chooses one concurrent assignment by a defined order, while a multi-value register retains concurrent alternatives. Automerge, for example, exposes an agreed winning value and retains conflicts for inspection. [Automerge conflicts][am-conflicts]

Recommendation: use per-slot registers for fixed sensor channels or a fixed board. Use stable row/column identities once a spreadsheet allows structural insertion, deletion, or reordering. A map keyed by shifting integer indices does not solve the example above. [ID-based list semantics][am-merge]

## 2. Specify operations before choosing an algorithm

| Operation  | Semantic question                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Insert     | How are concurrent insertions in the same gap ordered? Are related runs kept together?                 |
| Delete     | Which observed element IDs are removed? What happens to concurrent updates of those elements?          |
| Update     | Is this a write to the same element, a mutation of its nested object, or replacement by a new element? |
| Move       | Does the same element survive at one new position? Which concurrent move wins?                         |
| Range edit | Is this a collection of element operations, or does the application require stronger group semantics?  |

These are separate choices: the core Fugue paper specifies insert/delete, Automerge documents same-element updates, and Loro adds set/move to its movable list. [Fugue §IV][fugue] [Automerge][am-merge] [Loro][loro-list]

**Deletion does not mean “delete whatever later occupies these indices.”** In ID-based lists it targets the elements observed when the operation was created. An unseen concurrent insertion therefore has a distinct identity. [Automerge][am-merge] [Fugue Algorithm 1][fugue]

**Update versus delete is not universal.** Automerge explicitly makes a concurrent direct assignment to a list element win over deletion of that element. Do not transfer that rule to another library, or assume that changing a field inside a nested object is identical to replacing its parent list entry. [Automerge list merge rules][am-merge]

For example, starting from `[10, 20]`, one Automerge replica assigning `list[1] = 99` while another deletes that same element yields `[10, 99]` after merging. This is a direct consequence of the documented rule. For competing assignments, the visible winner uses operation-counter order with actor ID as the tie-breaker, not wall-clock time; the alternatives remain available through `getConflicts`. [Automerge merge rules][am-merge] [Conflict ordering][am-conflicts]

**Delete plus insert is replacement, not an identity-preserving set.** If two replicas replace the same original entry this way, both new entries can survive. Loro's tutorial demonstrates this and contrasts it with `MovableList.set`, which resolves to one value. [Loro][loro-list]

**Moving needs its own conflict policy.** Concurrent delete-and-reinsert “moves” can leave two copies. A real move retains logical identity and resolves competing positions; this is an extension to ordinary sequence insertion/deletion. Moving a range also raises additional questions beyond moving one element. [List-move paper abstract][move] [Loro][loro-list]

## 3. Algorithm families

### RGA: insertion references a predecessor

**Replicated Growable Array (RGA)** assigns an immutable ID to each element. An insertion references the element it follows, or the start of the sequence. The standard specification resolves competing insertions using descending ID order, with IDs ordered consistently with causality. [Mechanized RGA specification, §6][rga]

Deleting an element marks it as deleted while retaining its position information. This retained record is a **tombstone**. It lets a delayed concurrent operation still insert after the deleted element. The visible list skips tombstones. [RGA §6.1][rga]

RGA preserves forward insertion runs, but backward insertion patterns can interleave. “Backward” means repeatedly inserting before the previously inserted element, such as prepending related tasks one at a time. This is relevant beyond character editing. [Fugue §§II-C, III-A and Appendix A-A8][fugue]

RGA is a useful starting point for understanding sequence CRDTs. Its simple specification is not a performance prescription: the verification paper deliberately uses inefficient list traversal to make the proof clear. [RGA §6.1][rga]

Automerge's documented list merge rules follow this predecessor-reference approach: each new element in a forward run references the previous insertion. Its documentation also notes problems with reverse insertion patterns. [Automerge merge rules][am-merge]

### Logoot and LSEQ: order is encoded in position identifiers

This family gives each element an immutable, totally ordered position identifier. Inserting between `p` and `q` allocates a fresh identifier `x` with `p < x < q`; sorting identifiers gives the visible sequence. Identifiers can be variable-length paths, with replica identity ensuring uniqueness. [LSEQ manuscript, preliminaries][lseq-background]

The position identifier carries the ordering information, so the sequence need not retain a deleted element as an insertion anchor. The tradeoff is identifier growth: repeated insertion into a crowded interval can require longer paths. “No sequence tombstones” does not mean “no replication metadata.” [LSEQ preliminaries][lseq-background] [LSEQTree source][lseq-code]

**Logoot** explores random and boundary-based allocation. A boundary strategy leaves room on one side, which can work well for one editing direction and poorly for the opposite direction. The LSEQ authors analyze this behavior and include a Logoot coauthor. [LSEQ manuscript, allocation proposal][lseq-proposal]

**LSEQ** improves allocation by doubling the available base at increasing depths and choosing between two strategies: `boundary+` allocates near the preceding identifier, while `boundary−` allocates near the following one. The paper saves a random strategy choice per depth. [LSEQ proposal][lseq-proposal]

The linked **LSEQTree implementation differs from the paper here**: its default `_hash(depth) = depth % 2` alternates strategies by depth instead of choosing randomly. Keep that distinction when reproducing allocation behavior or comparing implementations. [LSEQTree constructor and `alloc`][lseq-code]

LSEQ addresses identifier size, not all sequence semantics. Its reported average-space behavior is not a fixed-size identifier guarantee or a universal operation-time bound. Logoot and LSEQ can still interleave concurrent insertion runs. [LSEQ preliminaries/proposal][lseq-background] [Fugue §III-A and Appendix A-A5][fugue]

### YATA and Yjs: insertion context on both sides

Yjs implements an adapted **YATA** algorithm. Current internals describe items with stable `(clientID, clock)` IDs and original left/right insertion references, `origin` and `originRight`. Deterministic integration uses this context to resolve concurrent insertions. The implementation has changes beyond the 2016 YATA paper, so the paper alone is not a complete specification of current Yjs. [Yjs internals][y-internals]

The library uses this sequence machinery for arrays, text, and other shared types. Consecutive compatible insertions can share a storage item rather than allocate one JavaScript object per logical element; later edits can split that item. This changes storage representation, not element identity. [Yjs internals][y-internals]

Yjs is better behaved on interleaving than simply sorting independently allocated positions. It is not maximally non-interleaving: the Fugue authors provide a backward-interleaving counterexample spanning multiple replica IDs. Their tested Yjs version is 13.6.8; this note does not claim to have rerun that example against every later release. [Fugue §§III-A, VI-A and Appendix A-A9][fugue]

### Fugue and FugueMax: explicit non-interleaving properties

Fugue represents insertion history as a tree with left and right children. In-order traversal produces the sequence, and deterministic sibling ordering resolves concurrency. Its logical tree need not be balanced. Deletion hides the node's value while retaining ordering structure. [Fugue §IV][fugue]

The purpose is to keep independently composed runs together in both forward and backward editing patterns. The paper also shows that a naive promise to avoid every possible interleaving is impossible: some concurrent constraints are incompatible. [Fugue §§III-B, V-B][fugue]

**FugueMax** satisfies the paper's formal **maximal non-interleaving** property. It orders right-side siblings by the reverse list order of their right origins, breaking ties by element ID. This uses the origins' sequence order, not a numeric comparison of origin IDs. **Fugue** is simpler and can interleave more than FugueMax in the exceptional situations where some interleaving is unavoidable. The two names are not interchangeable. [Fugue §§V-C–V-E][fugue]

The paper's base algorithms omit value mutation and moves. Those require composition with additional CRDT mechanisms. An ordering proof for insert/delete does not automatically prove the behavior of a move-enabled extension. [Fugue §IV][fugue] [List-move paper abstract][move]

### Comparison at the algorithm level

| Family              | Ordering information                              | Main tradeoff                                                     | Interleaving                                     |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| RGA                 | Predecessor identity and causality-compatible IDs | Deleted anchors remain in the basic structure                     | Forward runs preserved; backward anomalies exist |
| Logoot/LSEQ         | Dense, variable-length position IDs               | Identifier allocation/growth replaces reliance on deleted anchors | Concurrent runs can interleave                   |
| Yjs/YATA adaptation | Original insertion neighbors and item IDs         | Integration rules plus retained/compressed metadata               | Better grouping, but documented backward anomaly |
| Fugue               | Left/right insertion tree                         | Retained ordering structure; richer insertion rules               | Avoids the usual forward/backward anomalies      |
| FugueMax            | Fugue plus right-origin ordering                  | Stronger property with extra algorithmic machinery                | Formal maximal non-interleaving                  |

Sources for the table: [RGA specification][rga], [LSEQ manuscript][lseq-background], [Yjs internals][y-internals], and [Fugue definitions/counterexamples][fugue]. None of these rows implies built-in move or update semantics.

## 4. Network assumptions are part of correctness

**Causal delivery** means applying an operation after the operations it depends on. For example, insertion after element `X` must not be integrated before `X` exists. The verified RGA specification and Fugue's operation-based presentation use a causal broadcast model. That is a logical delivery requirement, not a requirement for a central server. [RGA §§5–6][rga] [Fugue §II-A][fugue]

Distinguish that model from a library's public import API. Yjs explicitly allows binary updates to arrive in any order and more than once. They are commutative, associative, and idempotent; all updates still need to reach participating replicas for convergence. [Yjs document updates][y-updates]

Tombstone-free deletion needs equivalent care. LSEQTree's `applyRemove` removes an existing identifier, while `applyInsert` adds an identifier/value pair. Applying a removal before its insertion, or replaying an old insertion after deletion, cannot be made safe by sorting positions alone. A delivery/deduplication layer or additional deletion knowledge is needed. This follows directly from those methods. [LSEQTree source][lseq-code]

The `rust-crdt` list source makes this contract explicit: it requires every operation and causal ordering, including insertion before deletion. It also tracks a vector clock to reject already-seen operations. This is evidence about that implementation, not a universal contract for every Logoot/LSEQ variant. [rust-crdt source][rust-list]

Recommendation: evaluate the sync protocol with the data structure. Test delayed dependencies, duplicate updates, long offline periods, and rejoining after compaction. A CRDT ordering rule alone does not deliver missing messages. [Yjs update contract][y-updates] [Loro shallow snapshots][loro-shallow]

## 5. Data model versus local index structures

The **logical ordering structure** determines which merged sequence is correct. A **local index structure** makes operations such as “find visible element 10,000” efficient. These are separate layers. RGA's verified specification and the optimized Fugue implementation deliberately use different levels of representation detail. [RGA §6.1][rga] [Fugue §VI][fugue]

Examples from inspected implementations:

- Yjs stores document-order links, per-client insertion-order arrays for ID lookup/sync, and search markers for nearby index lookups. [Internals][y-internals]
- Fugue's optimized implementation combines sequential nodes into “waypoints” rather than materializing each logical tree node separately. [Paper §VI][fugue]
- `rust-crdt` uses a `BTreeMap` keyed by identifiers, but its `position(index)` uses iterator `nth`; a tree keyed by ID does not automatically provide logarithmic rank lookup. [Source][rust-list]

In the published Yjs **13.6.33** source, `typeListGet` uses a search marker and traverses linked items; `findMarker` also traverses from a cached position. Its array API therefore should not be read as a constant-time random-access guarantee. [Pinned Yjs source][y-index-pinned]

A balanced tree with visible-subtree counts can be an implementation choice for indexed access. It does not change the conflict policy, and its lookup cost is not the cost of an entire CRDT edit: integration, dependency handling, allocation, and serialization also matter. Treat this as an implementation design, not a complexity guarantee for any library above.

For measurement, distinguish live elements, retained history/tombstones, compressed spans, identifier lengths, and concurrent edits in the same gap. Benchmark realistic index access, random editing, long deletion histories, load/save, and offline merge. The Fugue evaluation itself compares specified implementations and workloads, not timeless algorithm rankings. [Fugue §VI][fugue]

## 6. Tombstones, garbage collection, and history

These terms describe different operations:

1. **Logical deletion:** stop showing an element.
2. **Payload collection:** discard its deleted value while retaining needed structural metadata.
3. **Structural/history collection:** discard identifiers, anchors, or old operations themselves.
4. **Compression/compaction:** encode retained information more efficiently without necessarily forgetting it.

Yjs illustrates the distinction. With garbage collection enabled it can discard deleted content and use lightweight GC records where appropriate. Its struct store and delete information still participate in synchronization. Its binary `mergeUpdates` API combines updates but does not garbage-collect deleted content. [Yjs internals][y-internals] [Update API][y-updates]

For anchor-based algorithms, “everyone has seen the deletion” is not by itself a complete explanation of safe removal. Existing live descendants may still depend on that anchor, and delayed operations can reference it. The core Fugue algorithm therefore retains deleted nodes. Any stronger collection scheme needs its own argument about references and replica history. [Fugue §IV, Delete][fugue]

Automerge-repo's storage compaction combines stored changes into snapshots and removes incorporated storage chunks. That should not be described as deleting the document's semantic history. Its merge documentation explicitly models documents as carrying their history. [Automerge storage][am-storage] [Merge rules][am-merge]

Loro's **shallow snapshots** explicitly trim earlier history while retaining the current state. This changes synchronization eligibility: peers must be past the shallow boundary to sync normally. Offline retention requirements therefore affect how far history can be trimmed. [Loro shallow snapshots][loro-shallow]

## 7. Practical choices

| Library/type       | Array-facing operations                                           | Important semantic point                                                                                                    | Where I would start                                                     |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Yjs `Y.Array`      | `insert`, `delete`, `push`, `get`, iteration, nested shared types | Documented array API has no native identity-preserving `set`/`move`; a shared nested type can occur only once in a document | Applications already using Yjs, especially editor integrations          |
| Automerge list     | Array methods and index assignment inside `change`                | Assignment targets an element ID; concurrent assignments expose conflicts; direct update wins over concurrent delete        | Nested application documents where list entries also need value updates |
| Loro `List`        | Insert/delete and indexed access                                  | Replacing or moving by delete+insert can create multiple new entries                                                        | Sequences where entries do not need native set/move                     |
| Loro `MovableList` | Insert/delete plus `set` and `move`                               | Concurrent sets resolve to one value; concurrent moves leave one position for the element                                   | Sortable tasks, playlists, and drag-and-drop collections                |

Sources: [Y.Array API][y-array], [Automerge lists][am-lists], [Automerge merge rules][am-merge], [Automerge conflicts][am-conflicts], [Loro list tutorial][loro-list]. Recommendations in the last column are my synthesis.

For editable records, prefer nested shared maps/objects or stable application IDs with a separate record map. This separates record edits from ordering. It does **not** make delete-and-reinsert reordering safe by itself: the ordering layer still needs an explicit move/duplicate policy. [Y.Array nesting][y-array] [List-move motivation][move]

In Yjs, mutating a plain JSON object retrieved from an array does not produce a replicated field update; use nested shared types for those edits. In Automerge, make fine-grained mutations inside `change` instead of replacing a whole array or object when only one entry changed. [Yjs shared-type caveats][y-shared] [Automerge lists][am-lists]

Loro documents its lists as Fugue-based and its movable-list extension as based on Kleppmann's move algorithm. Its tutorial also uses the phrase “maximal non-interleaving” for Fugue. The 2025 paper reserves that exact proved property for FugueMax, so I would not infer a FugueMax-equivalence proof for current Loro from that wording alone. [Loro tutorial][loro-list] [Fugue §V][fugue]

Loro's implementation makes the identity/position distinction concrete: `MovableListState` keeps an element map separately from its ordered position records. An element stores both a value/version and a position, and `update_pos` redirects that same element to a position record. This is an implementation illustration from commit `27982a5`, inspected on 2026-09-28, rather than a package-version claim. Its first-party tests also check that concurrent moves do not increase the visible list length. [Pinned state implementation][loro-move-state] [Pinned concurrent-move test][loro-move-test]

### Recommendations by use case

- **Collaborative text:** start with a library's dedicated text type. For algorithm selection, treat non-interleaving as a requirement separate from convergence. [Yjs internals][y-internals] [Fugue][fugue]
- **General arrays with nested editable data:** compare Yjs and Automerge first on update semantics and integration needs, then measure the actual workload. [Y.Array][y-array] [Automerge lists][am-lists]
- **Identity-preserving reordering:** start with Loro `MovableList`; validate move-versus-delete and move-versus-update behavior against the application's expectations. [Loro list tutorial][loro-list]
- **Building a sequence CRDT to learn:** implement the verified RGA model first. Then study Fugue to see what additional ordering rules buy. [RGA][rga] [Fugue][fugue]
- **Studying position allocation or avoiding deleted anchors:** examine Logoot/LSEQ. Measure identifier growth and concurrent-run behavior rather than assuming shorter metadata or simpler ordering is always better. [LSEQ manuscript][lseq-proposal] [Fugue counterexamples][fugue]
- **Fixed slots:** use independent registers unless structural editing is actually required. The choice of concurrent-write policy remains explicit. [Automerge conflicts][am-conflicts]

## 8. Evidence and limits

This is a source-based comparison with small runtime spot checks, not a benchmark or a correctness proof. Public API claims use official documentation inspected for this note. Documentation and source links on moving branches are not package-version pins.

Published-package checks on **2026-09-26**, refreshed on **2026-09-28**, found **Yjs 13.6.33**, **Automerge 3.5.0**, and **Loro 1.16.3** under npm's `latest` tag. Yjs's pinned array source confirms the insert/delete/get API without native `set`/`move`; Loro's published declarations explicitly provide both `set` and `move`. These checks concern the stable APIs, not unreleased development branches. [Yjs package][y-package] [Yjs array source][y-array-pinned] [Automerge package][am-package] [Loro package][loro-package] [Loro declarations][loro-types]

The **2026-09-28 recheck** covered the RGA and Fugue papers, LSEQ manuscript sections and allocation/removal source, Yjs internals and array/update docs, Automerge list/conflict/merge/storage docs, Loro list/shallow-snapshot docs and the pinned movable-list implementation/tests, and `rust-crdt`'s list source. It confirmed the main comparisons above. Upstream source tests were read, not executed. Separate local experiments below checked specific mixed-operation cases.

RGA mechanics are grounded in the 2017 mechanized specification, not a claim to have read the inaccessible original 2011 article in full. LSEQ mechanics use the authors' manuscript source and implementation; Logoot allocation details are discussed in that manuscript. The HAL paper endpoints returned bot challenges. YATA details use Yjs's own internals because the current implementation differs from the original paper.

The Fugue source is the explicit **2025 v3** paper, including its impossibility result, distinctions between Fugue/FugueMax, and version-specific interleaving examples. No benchmark numbers have been extrapolated to current Yjs, Automerge, or Loro.

Open application-specific questions: required move/delete policy, nested-object deletion semantics, offline retention window, undo/history requirements, and target workload. These determine the choice more directly than the name of the sequence algorithm.

### Runtime spot checks, 2026-09-28

These are original observations using the three exact package versions above under Node.js **26.8.2**. Each case started from one shared history, created two independent replicas, applied one edit sequence per replica before synchronization, and exchanged both branches. Assertions confirmed equal visible results on both replicas in all seven cases. These examples test specific histories, not every concurrent schedule.

Unless stated otherwise, the starting list was `[1, 2, 3]`, and both peers targeted the original occurrence of `2`:

| Type                     | Peer A                               | Peer B                               | Observed merged list                                                                   |
| ------------------------ | ------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Yjs `Y.Array`            | `delete(1, 1)` then `insert(0, [2])` | `delete(1, 1)` then `insert(2, [2])` | `[2, 1, 3, 2]`: duplicate value from two new occurrences                               |
| Automerge list           | `items[1] = 20`                      | `items.splice(1, 1)`                 | `[1, 20, 3]`: direct assignment survived                                               |
| Loro `MovableList`       | `move(1, 0)`                         | `move(1, 2)`                         | `[1, 3, 2]` in this run: one occurrence; winning position depends on conflict ordering |
| Loro `MovableList`       | `move(1, 0)`                         | `delete(1, 1)`                       | `[2, 1, 3]`: moved occurrence survived                                                 |
| Loro `MovableList`       | `set(1, 20)`                         | `delete(1, 1)`                       | `[1, 3]`: deleted occurrence stayed absent                                             |
| Loro `MovableList`       | `move(1, 0)`                         | `set(1, 20)`                         | `[20, 1, 3]`: position and value edits combined                                        |
| Automerge nested objects | `items[1].n = 20`                    | `items.splice(1, 1)`                 | Starting from `[{n:1}, {n:2}, {n:3}]`, result was `[{n:1}, {n:3}]`                     |

Reproduction setup: install `yjs@13.6.33`, `@automerge/automerge@3.5.0`, and `loro-crdt@1.16.3`. For Yjs, initialize replicas with `encodeStateAsUpdate`/`applyUpdate`, then capture both edited states before cross-applying them. For Automerge, use `from`, two `clone` calls, mutations inside `change`, and `merge` in both directions. For Loro, initialize two new `LoroDoc` instances by importing the same snapshot, then capture both `export({mode: "update"})` results before cross-importing them. Inspect `toJSON()` or the merged Automerge value. [Yjs update API][y-updates] [Automerge list API][am-lists] [Loro declarations][loro-types]

The practical distinction is visible here: updating an Automerge list entry is different from updating a field inside its child object. Likewise, Loro's native move and native set did not behave identically against a concurrent delete in these histories. Choose the required behavior explicitly rather than assuming one universal “update wins” or “delete wins” rule.

## Primary sources

- [RGA specification and mechanized convergence proof, Gomes et al., 2017][rga].
- [LSEQ paper source, Nédelec et al., 2013][lseq-paper], especially [preliminaries][lseq-background] and [allocation][lseq-proposal]; [author implementation][lseq-code].
- [Yjs internals][y-internals], [array API][y-array], and [binary update contract][y-updates].
- [The Art of the Fugue, Weidner and Kleppmann, 2025 revision][fugue]; [authors' implementations][fugue-code].
- [Moving Elements in List CRDTs, Kleppmann, 2020, author page/abstract][move].
- [Automerge lists][am-lists], [merge rules][am-merge], [conflicts][am-conflicts], and [storage][am-storage].
- [Loro List/MovableList][loro-list] and [shallow snapshots][loro-shallow].
- [rust-crdt list source][rust-list], used only for its implementation/delivery contract.

[rga]: https://arxiv.org/html/1707.01747v3#S6
[fugue]: https://arxiv.org/html/2305.00583v3
[fugue-code]: https://github.com/mweidner037/fugue
[lseq-paper]: https://github.com/parchemins/paper-lseq-tex
[lseq-background]: https://github.com/parchemins/paper-lseq-tex/blob/master/input/background.tex
[lseq-proposal]: https://github.com/parchemins/paper-lseq-tex/blob/master/input/proposal.tex
[lseq-code]: https://github.com/Chat-Wane/LSEQTree/blob/master/lib/lseqtree.js
[rust-list]: https://github.com/rust-crdt/rust-crdt/blob/master/src/list.rs
[y-internals]: https://github.com/yjs/yjs/blob/main/INTERNALS.md
[y-array]: https://docs.yjs.dev/api/shared-types/y.array
[y-updates]: https://docs.yjs.dev/api/document-updates
[am-lists]: https://automerge.org/docs/reference/documents/lists/
[am-merge]: https://automerge.org/docs/reference/under-the-hood/merge-rules/
[am-conflicts]: https://automerge.org/docs/reference/documents/conflicts/
[am-storage]: https://automerge.org/docs/reference/under-the-hood/storage/
[loro-list]: https://loro.dev/docs/tutorial/list
[loro-shallow]: https://loro.dev/docs/concepts/shallow_snapshots
[move]: https://martin.kleppmann.com/2020/04/27/papoc-list-move.html
[y-index-pinned]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/types/AbstractType.js#L618-L634
[y-array-pinned]: https://github.com/yjs/yjs/blob/9ea3a4fb57b814292ce18dfd13c4f422e44e6c5c/src/types/YArray.js
[y-shared]: https://docs.yjs.dev/getting-started/working-with-shared-types
[y-package]: https://registry.npmjs.org/yjs/13.6.33
[am-package]: https://registry.npmjs.org/@automerge/automerge/3.5.0
[loro-package]: https://registry.npmjs.org/loro-crdt/1.16.3
[loro-types]: https://unpkg.com/loro-crdt@1.16.3/bundler/loro_wasm.d.ts
[loro-move-state]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-internal/src/state/movable_list_state.rs
[loro-move-test]: https://github.com/loro-dev/loro/blob/27982a553733c54574c2ab63d56ba343b69aa8cb/crates/loro-wasm/tests/movable_list.test.ts#L125-L139
