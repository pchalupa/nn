# Persisting CRDT metadata

Research date: **2026-10-04**. Scope: durable local storage for this repo's registers, maps and RGA collections, with comparisons to Yjs and Automerge. Sources are official documentation, specifications, first-party source code and the current working tree. Recommendations are identified separately from observed behavior.

The working tree contains ongoing implementation changes. This note describes the files inspected at the end of the research, not only committed code. It does not replace [ADR-06][adr06] or introduce a new storage decision.

Update, 2026-10-04: [ADR-10](../../decisions/ADR-10-defer-store-integration-until-view-materialization.md) subsequently deferred automatic Store persistence, `flush()` and Store-side projection filtering until view materialization is complete. The observations below describe the earlier prototype. Links for its removed coordinator and tests now point to the retained follow-up plan; current IndexedDB tests save records explicitly.

## Short answer

**Persist the state that determines future merges, not just the values currently displayed.** A register needs its original timestamp; a sequence needs insertion identities, predecessor references and deletion information. Rebuilding those from visible values changes what a later merge can do. RGA's specification explicitly retains deleted elements so concurrent insertions can still locate their predecessor. [Register implementation][register] [RGA specification, §6.1][rga-paper]

**Recommendation for this repo:** keep ADR-06's complete, entity-owned record per Store root as the persistence baseline. Save values and metadata together, restore identities without generating new ones, and await transaction completion through `Store.flush()`. This is already the chosen architecture, not a proposal to adopt an operation log. [ADR-06][adr06] [Persistence coordinator][persistence] [IndexedDB adapter][indexeddb]

The important limitations are:

- Restoring register timestamps does not currently advance the clock used for later register writes. A new write can receive an older timestamp and lose to saved state during a merge. [Time][time] [Register][register]
- Register merge has no tie-breaker for different values with equal timestamps. Persistence can preserve that state, but cannot make it converge. [Register][register]
- Serializing writes inside one Store does not coordinate independent Store instances or tabs. Replacing the same database key can discard another writer's state. ADR-06 explicitly excludes that coordination. [ADR-06][adr06] [Persistence][persistence]
- Whole-root writes serialize retained history too. Tombstones and retired sequence elements remain in the record; the chosen design has no bounded-history policy. [ADR-06][adr06] [RGA][rga]

## 1. What must survive a restart?

A **projection** is the application-facing value, such as an array of visible rows. A **CRDT record** includes the information that merge uses, even when it is invisible. In this repo, `toJSON()` exposes `current`, while each entity implements `toRecord()` separately. [Entity][entity] [Register][register] [Map][map] [RGA][rga]

Recommendation: use this as a persistence correctness condition:

```text
merge(restore(save(state)), delayedRemoteState)
```

must produce the same application result as merging that remote state into the uninterrupted original. Also compare exported records where their representation is canonical. Visible equality immediately after reload is a weaker test: it misses lost deletion information and changed timestamps. The existing delayed-insertion and stale-replica tests already use this stronger comparison. [Entity restoration tests][entity-tests] [IndexedDB persistence tests][idb-tests]

### Metadata inventory for the current implementation

| Entity             | Persist                                                                  | Why                                                                        |
| ------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| All entities       | `kind`, exact `key`                                                      | Select the decoder and preserve entity identity.                           |
| LWW register       | `value`, original `timestamp`                                            | Merge compares timestamps, not just values.                                |
| Map                | A complete child record per field in `fields`                            | Each field carries its own value and merge state.                          |
| RGA root           | `clock`                                                                  | Later sequence insertions must follow observed sequence timestamps.        |
| RGA element        | `id.time`, `id.key`, `after`, optional child `row`, optional `removedAt` | Preserve occurrences and insertion anchors, including retired occurrences. |
| RGA deletion state | `tombstones`, mapping row keys to deletion timestamps                    | Suppress stale insertions while allowing sufficiently newer reinsertion.   |

These are the fields exported by the current codecs, not a universal CRDT schema. The current RGA exports `removedAt` when present, but its ordinary `retire()` path records the deletion in `tombstones` and clears the row without assigning `removedAt`. Do not claim every retired element has a deletion timestamp in that field. [Record container][record] [Register][register] [Map][map] [RGA, `toRecord`, `retire` and `detach`][rga]

The current map contains child entities and merges matching local fields; it does not implement a general observed-remove map with field-deletion history. If dynamic field deletion becomes a replicated operation, its semantics and additional metadata need a separate design. Serializing the current fields alone would not supply that missing algorithm. [Map, `current` and `merge`][map]

Do **not** persist event listeners, unsubscribe functions, cached projections, revisions or lookup indexes as CRDT state. Constructors and restoration rebuild those runtime structures. [Entity][entity] [Map][map] [RGA][rga]

### Example: one root record

This is the stored field shape for a root containing one deleted anchor and one live row inserted after it. The JSON example uses only JSON-compatible payloads for readability; it is not a promise that arbitrary register payloads support JSON text encoding. In memory, `toRecord()` currently returns an `EntityRecord` instance. [Record][record] [RGA][rga]

```json
{
	"kind": "rga",
	"key": "tickets-root",
	"clock": "2026-10-04T10:00:00.000Z+00003",
	"elements": [
		{
			"id": {
				"time": "2026-10-04T10:00:00.000Z+00001",
				"key": "deleted-row"
			}
		},
		{
			"id": {
				"time": "2026-10-04T10:00:00.000Z+00003",
				"key": "live-row"
			},
			"after": {
				"time": "2026-10-04T10:00:00.000Z+00001",
				"key": "deleted-row"
			},
			"row": {
				"kind": "map",
				"key": "live-row",
				"fields": {
					"title": {
						"kind": "register",
						"key": "title-field",
						"value": "Keep the anchor",
						"timestamp": "2026-10-04T10:00:00.000Z+00002"
					}
				}
			}
		}
	],
	"tombstones": {
		"deleted-row": "2026-10-04T10:00:00.000Z+00002"
	}
}
```

The repository key is the Store property name, for example `tickets`, not necessarily the root entity's `key`. The coordinator calls `repository.set(name, record, name)`, and hydration reads `repository.get(typeName, typeName)`. Removing the last visible row therefore still leaves a root record containing history. [Persistence][persistence] [State hydration][state] [ADR-06][adr06]

## 2. Storage layout choices

| Layout                                      | Benefit                                                                 | Cost or requirement                                                                                               | Fit here                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Complete record per root                    | One atomic root replacement; straightforward restoration.               | A small edit captures and writes the whole root; independent writers need coordination.                           | Already selected by ADR-06.                                  |
| Records per row, field and sequence element | Smaller writes and easier targeted storage reads.                       | Transactions must cover related values, anchors, deletions and clock changes; restoration needs a consistent set. | A future alternative, not the current decision.              |
| Append mergeable updates plus checkpoints   | Preserve incremental changes and reduce repeated whole-document writes. | Requires a durable update format, replay, deduplication and safe compaction rules.                                | Used by Yjs and Automerge; rejected for this implementation. |
| Visible rows only                           | Simple application data.                                                | Cannot recover original merge metadata or deleted anchors.                                                        | Not sufficient for resumable CRDT state.                     |

The first two tradeoffs and the rejected log are recorded in ADR-06. The log comparison follows the official Yjs provider source and Automerge storage model. This is an architectural comparison, not a measured performance ranking. [ADR-06][adr06] [Yjs IndexedDB provider][y-idb] [Automerge storage][am-storage]

Recommendation: measure snapshot size, capture CPU, adapter commit time and retained-history growth before changing layouts. Include a large collection with mostly retired elements, not just many live rows. A checkpoint that merges log entries is not automatically permission to discard CRDT deletion history. Yjs explicitly distinguishes merging updates from garbage-collecting deleted content. [Yjs update API][y-updates]

## 3. What established libraries persist

### Yjs: binary updates, not a value export

Yjs exposes `encodeStateAsUpdate(doc)` for the document state, `applyUpdate(doc, bytes)` for restoration and incremental `update` events that can be stored in a database. Updates are documented as commutative, associative and idempotent. Its internal update representation includes inserted structures and deletion information. [Yjs update API][y-updates] [Yjs internals][y-internals]

A **state vector** describes the known insertion clocks per client. It is useful for requesting missing updates, but is not the document contents. Yjs also uses the term **snapshot** for a state vector plus a delete set, which depends on the document structures to recover an old view. Do not confuse that historical marker with a self-contained persisted full-state update. [Yjs internals, Network protocol and Snapshots][y-internals]

The inspected `y-indexeddb` provider stores binary updates under automatically generated keys in an `updates` object store. `fetchUpdates()` loads and applies them. `storeState()` fetches stored updates, writes `encodeStateAsUpdate(doc)` and removes an older covered key range. The source uses a preferred trim size of 500 updates. Those constants are implementation details, not recommendations for this repo. Its `synced` event is emitted after applying initial updates; the source does not define this as an equivalent of this repo's commit-waiting `flush()` boundary. [Provider source at `ff468b5e`][y-idb]

Yjs garbage collection can discard deleted content while retaining structural deletion information. `mergeUpdates()` alone does not garbage-collect it. This is specific to Yjs's representation, not evidence that our RGA can delete its retained anchors. [Yjs internals, Deletions][y-internals] [Yjs update API][y-updates]

### Automerge: compressed documents and independently keyed chunks

Automerge's `save()` returns a compressed document that `load()` or `loadIncremental()` can consume. Its documents carry change history, and its list operations reference stable element IDs rather than current numeric positions. [Automerge save API][am-save] [Automerge merge rules][am-merge]

`automerge-repo` stores chunks with keys shaped like:

```text
[documentId, "incremental", hashOfChangeBytes]
[documentId, "snapshot", identifierDerivedFromHeads]
```

**Heads** identify the current tips of the change history. Restoration loads and merges all relevant chunks. Compaction only deletes chunks that the compactor loaded and incorporated, so another writer's unseen chunk is not deleted. This avoids requiring a single mutable document key with a read/replace transaction spanning all writers. [Automerge storage model][am-storage]

Recommendation if multiwriter storage becomes necessary here: evaluate this independently keyed, mergeable-chunk pattern alongside a coordinated single-writer design. Do not copy the layout without defining what our mergeable chunk contains and how recovery proves a compacted chunk covers the inputs being deleted. This would revisit ADR-06's rejected log alternative and requires an explicit new decision. [ADR-06][adr06] [Automerge storage model][am-storage]

## 4. Atomicity, ordering and crash recovery

### Values and metadata need the same commit boundary

Recommendation: never commit a new value separately from the timestamp or deletion information that gives it meaning. Whole-root records achieve this with one database write. With normalized records, put all affected records in one transaction instead. IndexedDB commits transaction changes atomically and rolls them back on abort. [IndexedDB §2.7.1][idb-lifecycle] [ADR-06][adr06]

The current coordinator:

1. Tracks a requested generation per root, including an initial save.
2. Captures a detached record in a microtask after synchronous mutations.
3. Allows only one in-flight write per root.
4. Resolves a flush waiter when a committed generation covers its requested generation.
5. Retains failure state for reporting and retries on a later flush.

These are implementation facts; roots still commit independently. `flush()` does not create a transaction spanning unrelated roots. [Persistence][persistence] [Persistence tests][persistence-tests]

The IndexedDB adapter resolves writes on `transaction.oncomplete`, not request success. That matters because a transaction can abort after an individual request succeeds. An aborted root replacement leaves the previously committed record rather than a half-updated value/metadata pair. [IndexedDB adapter][indexeddb] [IndexedDB lifecycle][idb-lifecycle]

**Commit completion is not an unconditional power-loss guarantee.** IndexedDB defines `strict`, `relaxed` and `default` durability hints. The adapter currently supplies no explicit durability option. Default behavior is browser-defined for the storage bucket, so do not describe this `flush()` as a guaranteed disk `fsync`. [IndexedDB §2.7][idb-transactions] [Adapter][indexeddb]

### Multiple tabs can still lose state

Consider two Stores loaded from the same root record:

```text
Tab A edits title and writes record A.
Tab B edits assignee and writes record B, based on the old root.
The key now contains B, which never incorporated A's title edit.
```

This is a consequence of replacement writes without a merge/read step. IndexedDB schedules overlapping write transactions, but serial execution of two replacements does not merge their contents. The current coordinator orders only its own writes. [IndexedDB scheduling][idb-scheduling] [Persistence][persistence] [Adapter][indexeddb]

Recommendations, depending on the product requirement:

- Keep one coordinated persistence owner per database/root and send changes to it.
- Or implement a storage-level atomic read/merge/write boundary, with an adapter API that owns the entire transaction. A separate `get()` followed by `set()` is not that boundary.
- Or append independently keyed mergeable updates and merge them during recovery, as Automerge does.

These are future design options. The existing Repository API does not expose the shared transaction needed by the second option, and ADR-06 explicitly does not coordinate independent writers. [Repository][repository] [ADR-06][adr06] [Automerge storage][am-storage]

## 5. Clocks and writer identity

Preserve old operation identities exactly, but separately decide how a restarted writer generates **new** identities. A record key is not automatically a writer ID. Yjs documents session-scoped client IDs that should not be reused across sessions. Automerge's writable `clone()` generates a new actor ID to avoid duplicate sequence numbers; `load()` accepts an actor option and otherwise creates a random actor ID. Neither library establishes a universal rule that one device ID must always be persisted and reused. [Yjs Doc API][y-doc] [Automerge clone API][am-clone] [Automerge load API][am-load]

### Current Time behavior: directly checked

`Time.fromTimestamp()` reconstructs an instance but does not update `GlobalTime`. `Time.now()` uses only the module's global clock and `Date.now()`. The register factory preserves its saved timestamp; its setter later calls `Time.now()`. [Time][time] [Register][register]

A fresh Node process running the current Time module produced:

```text
saved: 2099-01-01T00:00:00.000Z+00005
next:  2026-10-04T10:20:21.367Z+00000
next.isAfter(saved): false
```

The same runtime check accepted these inputs:

| Input suffix after a valid ISO date | Parsed counter |
| ----------------------------------- | -------------- |
| `+xyz`                              | `NaN`          |
| `+00001junk`                        | `1`            |
| `+00001+extra`                      | `1`            |

The module was compiled to a temporary directory with the installed TypeScript compiler and executed without modifying repository source. These outcomes follow from splitting the string and accepting `parseInt()` without checking the entire counter or the number of parts. [Time, `fromTimestamp`][time]

Recommendations:

- Complete strict timestamp parsing in Time before treating entity decoding as full timestamp validation.
- Observe accepted hydrated and merged timestamps before allowing new local register writes. Define future-clock handling and counter exhaustion in the clock API rather than hiding workarounds in record decoders.
- Test restart in a fresh process or isolated module with a backward wall clock. Same-process round trips can hide missing clock restoration because the global clock is still warm.
- Define deterministic conflict ordering for distinct writes with the same timestamp. The current register's two strict `isAfter()` branches leave equal-stamp, different-value registers different after merge.

The RGA already preserves a root clock and locally increments beyond it in `tick()`. This protects sequence timestamps after restoration, but it does not observe timestamps for nested registers or fix equal-stamp register conflicts. RGA element IDs combine time and row key; concurrent insertions of the same row key with the same timestamp deserve explicit collision tests. [Time][time] [Register][register] [RGA, `tick`, `idOf` and `outranks`][rga]

ADR-06 already records strict parsing and clock observation as separate Time dependencies. This research confirms the gap; it does not authorize changing Time or the chosen timestamp format. [ADR-06][adr06]

## 6. Tombstones, encoding and retention

### Do not remove anchors just because they are old

RGA's retained deleted elements allow insertions that still reference those elements. A saved empty collection can therefore contain meaningful history. In this implementation, element anchors and key-level tombstones serve different purposes, so keeping just one of them is not sufficient. [RGA specification §6.1][rga-paper] [RGA implementation][rga]

Recommendation: retain them under the current design. Before adding garbage collection, define an algorithm-specific safety condition covering stale replicas and delayed references. Possible inputs include acknowledgements from admitted replicas and a policy requiring sufficiently old replicas to resynchronize from a new baseline. An elapsed-time cutoff alone supplies no evidence that a delayed insertion or stale state cannot arrive. This is a design requirement, not a proven garbage-collection algorithm. ADR-06 currently accepts unbounded tombstone history. [ADR-06][adr06] [RGA specification][rga-paper]

Log compaction, deleted-payload removal and deletion-metadata garbage collection are three different operations. Yjs illustrates the distinction: it can compact binary updates and discard deleted payload content while retaining the information needed by its algorithm. Do not transfer those guarantees to our representation. [Yjs updates][y-updates] [Yjs internals][y-internals]

### Structured storage is not JSON text

IndexedDB stores values using `StructuredSerializeForStorage` and retrieves them by value. This supports more than JSON-compatible plain data. Our record capture converts `Time` values to strings, recursively captures containers and uses `structuredClone()` for other payloads; `cloneValue()` rejects shared memory to maintain detachment. Unsupported values must be reported, not silently omitted. [IndexedDB values][idb-values] [Record][record] [Clone helper][clone]

Recommendation: keep the storage codec separate from the value projection and from any future network/export codec. A JSON-text backend needs an explicit supported-value policy or tagged encoding for payloads such as `undefined`, maps, buffers and cycles. The current IndexedDB round trip does not establish a JSON round-trip guarantee. [ADR-06][adr06] [Record][record] [Entity restoration tests][entity-tests]

Recommendation: protect locally created data against storage pressure with a persistent-storage request where appropriate, and offer replication or backup. The browser Storage Standard distinguishes best-effort and persistent buckets; a successful database transaction does not prevent later user deletion of the bucket. [WHATWG Storage §§5, 7][storage-standard]

## 7. Current documentation/code differences

These differences need an owner decision. This research changes neither the recorded decision nor implementation:

1. **Persistence signal:** ADR-06 specifies a separate `subscribeRecord` notification. Current `Entity` exposes only `subscribe`, `Persistence.add()` uses it, and RGA metadata-only changes emit the ordinary change signal. Store filters notifications by materialized-view identity rather than by a separate persistence subscription. [ADR-06][adr06] [Entity][entity] [Persistence][persistence] [RGA][rga] [Store][store]
2. **Record representation and repository responsibility:** ADR-06 calls `EntityRecord` a union of supported formats and describes a CRDT-unaware repository. The current `EntityRecord` is a generic class; the IndexedDB adapter imports it and reconstructs record-shaped top-level results on reads. Its field shape still supports the root-record layout, but these API and responsibility descriptions differ. [ADR-06][adr06] [Record][record] [IndexedDB adapter][indexeddb]

Should the implementation return to ADR-06's contracts, or should a new ADR record these changes? The repository guide requires preserving recorded decisions and documenting reversals explicitly. [Repository guide][guide]

## 8. Validation and next steps

Focused verification during this research:

```sh
pnpm exec vitest run packages/entities/src/fromRecord.test.ts packages/store/src/Persistence.test.ts packages/index-db-repository/src/Persistence.test.ts
```

Result: **3 files, 48 tests passed**. Existing coverage includes detached records, original keys/timestamps, undefined values, retired anchors, stale-replica suppression, delayed insertions, metadata-only persistence, per-root write ordering, overlapping flush barriers, retry and schema rejection before writes. These tests are not browser power-loss or multi-tab crash tests. [Entity tests][entity-tests] [Coordinator tests][persistence-tests] [IndexedDB tests][idb-tests]

Recommendations, in priority order:

1. Resolve the two documentation/code differences above before extending the persistence contract.
2. Deliver and integrate strict Time parsing and clock observation; add a fresh-process restart/write/merge test.
3. Add equal-timestamp register and same-key sequence-ID collision tests. Persisting an invalid ordering model faithfully does not repair it.
4. Decide whether independent writers are a supported use case. If not, state and enforce the single-writer limitation. If yes, design coordination or mergeable storage before relying on shared IndexedDB.
5. Exercise abort after request success, quota failure, close during a pending write and restart from the last committed root in a real browser.
6. Measure live and retained-history workloads before adopting normalized records or a log. Keep tombstone garbage collection out of storage cleanup until its safety rule is defined.

These are follow-up recommendations, not implemented changes or a new approved plan.

## Sources

### External primary sources

- Gomes, Kleppmann, Mulligan and Beresford, _Verifying Strong Eventual Consistency in Distributed Systems_, §6.1: immutable RGA IDs, predecessor references and retained tombstones. The paper's verified operation-based model is not a proof of this repo's custom key-level reinsertion semantics. [Paper][rga-paper]
- Yjs official [document-update API][y-updates] and [Doc API][y-doc], accessed 2026-10-04.
- Yjs [internals][y-internals], commit `4d75cc8e4024dbb1f554737aa93c68b2e54adebe`.
- `y-indexeddb` [provider source][y-idb], commit `ff468b5e9cb329165d7db7a9a9c4cf948aee5f5f`.
- Automerge official [storage model][am-storage] and [merge rules][am-merge], accessed 2026-10-04.
- Automerge v3.5.0 [save][am-save], [load][am-load] and [clone][am-clone] API pages, linking implementation commit `4d2a8f6bfecfb7f1e4fca126e6d2122ac526f903`.
- W3C _Indexed Database API 3.0_, Editor's Draft dated 2025-08-13: [values][idb-values], [transactions/durability][idb-transactions], [lifecycle][idb-lifecycle] and [scheduling][idb-scheduling]. This is a draft specification, not a report of every browser's behavior.
- WHATWG _Storage_, Living Standard dated 2026-03-15: persistence permission and storage pressure. [Specification][storage-standard]

### Repository sources

Links below refer to the working tree inspected on 2026-10-04. Related background notes: [Array-like CRDTs](array-like-crdts.md) and [Hybrid Logical Clocks](hybrid-logical-clocks.md). Their conclusions are not substituted for the primary-source checks above.

[adr06]: ../../decisions/ADR-06-persist-entity-owned-root-records.md
[guide]: ../../../AGENTS.md
[entity]: ../../../packages/entities/src/Entity.ts
[record]: ../../../packages/entities/src/EntityRecord.ts
[register]: ../../../packages/entities/src/LWWRegister.ts
[map]: ../../../packages/entities/src/LWWMap.ts
[rga]: ../../../packages/entities/src/RGA.ts
[clone]: ../../../packages/entities/src/cloneValue.ts
[time]: ../../../packages/time/src/Time.ts
[store]: ../../../packages/store/src/Store.ts
[state]: ../../../packages/store/src/State.ts
[persistence]: ../../superpowers/plans/2026-10-03-crdt-root-snapshots.md#resume-after-view-materialization
[repository]: ../../../packages/repository/src/Repository.ts
[indexeddb]: ../../../packages/index-db-repository/src/IndexDbRepository.ts
[entity-tests]: ../../../packages/entities/src/fromRecord.test.ts
[persistence-tests]: ../../superpowers/plans/2026-10-03-crdt-root-snapshots.md#resume-after-view-materialization
[idb-tests]: ../../../packages/index-db-repository/src/Persistence.test.ts
[rga-paper]: https://arxiv.org/html/1707.01747v3#S6.SS1
[y-updates]: https://docs.yjs.dev/api/document-updates
[y-doc]: https://docs.yjs.dev/api/y.doc
[y-internals]: https://github.com/yjs/yjs/blob/4d75cc8e4024dbb1f554737aa93c68b2e54adebe/INTERNALS.md
[y-idb]: https://github.com/yjs/y-indexeddb/blob/ff468b5e9cb329165d7db7a9a9c4cf948aee5f5f/src/y-indexeddb.js
[am-storage]: https://automerge.org/docs/reference/under-the-hood/storage/
[am-merge]: https://automerge.org/docs/reference/under-the-hood/merge-rules/
[am-save]: https://automerge.org/automerge/api-docs/js/functions/save.html
[am-load]: https://automerge.org/automerge/api-docs/js/functions/load.html
[am-clone]: https://automerge.org/automerge/api-docs/js/functions/clone.html
[idb-values]: https://w3c.github.io/IndexedDB/#value-construct
[idb-transactions]: https://w3c.github.io/IndexedDB/#transaction-construct
[idb-lifecycle]: https://w3c.github.io/IndexedDB/#transaction-lifecycle
[idb-scheduling]: https://w3c.github.io/IndexedDB/#transaction-scheduling
[storage-standard]: https://storage.spec.whatwg.org/
