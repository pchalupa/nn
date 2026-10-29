# Connecting materialized snapshots back to CRDT nodes

Research date: **2026-10-29** (published package sources, pinned GitHub sources, official documentation, and runtime probes against this repository).
Scope: how a system that hands out plain JS values (read snapshots) routes edits made on a copy of those values back to the right CRDT node (stable element or object ID), rather than to an array index or a guess. Companions: [Array-like CRDTs](array-like-crdts.md), [Map- and object-like CRDTs](map-object-crdts.md), [Materialized views](materialized-view.md), [React reconciliation](react-reconciliation.md).

Versions read: `@automerge/automerge@3.5.0`, `@automerge/automerge-repo@2.6.0-alpha.3`, `yjs@13.6.33`, `loro-crdt@1.17.1`, `loro-mirror@2.3.3`, `immer@11.2.9`, `immer-yjs@1.2.0`, `valtio-yjs@0.7.0`, `@syncedstore/core@0.6.0`, `mobx-state-tree@9.0.0`, `jazz-tools@0.20.19`, `tinybase@10.0.1`, `@legendapp/state@2.1.15`. Runtime probes ran on Node v26.11.1.

## Short answer

Every system surveyed uses one of four bridges, and most combine two:

1. **No snapshot at all: edit the live CRDT object.** Yjs, SyncedStore, Jazz, and Automerge inside `change()` hand out the CRDT node itself or a proxy bound to its object ID. Identity cannot be lost because the user never holds a copy. [Automerge proxy][am-proxy-objid] [SyncedStore array][ss-array-reassign] [Yjs `_item`][y-abstract-item]
2. **A hidden ID stamped on the materialized object.** Automerge stamps every materialized object with a non-enumerable, non-writable `Symbol.for("_am_objectId")`. loro-mirror stamps a non-enumerable `$cid` string. Both are lost by `{...row}`, and loro-mirror had to reconfigure Immer to stop dropping it. [Automerge export cache][am-export-hidden] [loro-mirror Immer instance][lm-immer]
3. **A reference-identity side table.** MobX-State-Tree reconciles a value against a node when `oldNode.snapshot === newValue`. That is the same idea as `@nn/store`'s `RowIdentity` WeakMap, and it shares the same weakness: any copy is a stranger. [MST `areSame`][mst-aresame]
4. **A key declared in the data, matched by a keyed diff.** MST's `types.identifier`, loro-mirror's `idSelector`, Legend-State's `id`/`key`/`_id` detection, TinyBase's row IDs, and React's `key` all match old and new items by a value the application can see. This is the only bridge that survives spreading, `structuredClone`, JSON round-trips, and rows rebuilt from scratch. It is also the only one that can detect a move, and therefore express one. [MST reconciliation docs][mst-reconcile-doc] [loro-mirror README][lm-readme-list] [Legend `findIDKey`][legend-findid] [React keys][react-keys]

For `@nn/store`, the recommendation is to **let the schema declare a row key for arrays of objects and use its value as the `RGA` element key**. Keep `RowIdentity` only as a fallback for arrays without a declared key. Replace whole-state `structuredClone` with a copy-on-write draft. Make primitive arrays either diff-based or explicitly index-addressed. Details and trade-offs are in §8.

## 1. The problem in `@nn/store` today

`State.read()` materializes each root field through [`View`][nn-view], and records the `RGA` element each row object came from in [`RowIdentity`][nn-rowidentity], a `WeakMap<object, { owner, key }>` ([`View.ts:36`][nn-view]). `State.update()` builds a draft with `RowIdentity.clone`, which runs `structuredClone` and then walks source and clone in parallel to copy identities onto the clones ([`RowIdentity.ts:30-47`][nn-rowidentity], [`State.ts:89`][nn-state]). `normalize` copies identities again onto its rebuilt objects ([`normalize.ts:21`][nn-normalize]). `prepareRows` then looks up each draft row: a hit reuses the element key, a miss mints a new UUID, and any order other than "survivors in old order, then additions" throws `unsupported("move")` ([`reconcile.ts:84-99`][nn-reconcile]). Arrays of primitives skip identity and match by index ([`reconcile.ts:56-62`][nn-reconcile]).

Probes against the current working tree (a scratch Vitest file importing `State.ts`; no repository code changed) show what that means in practice:

| Recipe on rows `[A, B, C]`                                     | Result                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `d.rows = d.rows.map(r => r === B ? { ...r, done: true } : r)` | throws `Store operation "move" is not supported yet.`, because B's copy is unknown and gets appended last             |
| `d.rows[last] = { ...d.rows[last], done: true }`               | succeeds, but removes the old element and creates a new one with a fresh key                                          |
| `d.rows.reverse()` or `splice` + `push` of the same row        | throws `unsupported("move")`                                                                                          |
| `d.tags.unshift("w")` on `["x", "y"]`                          | reads back `["w", "x", "y"]`, but register 0 was overwritten with `"w"`, register 1 with `"x"`, and `"y"` was created |

The first row is the idiomatic immutable-update pattern most React developers write first. The last row looks correct locally, but every existing element was rewritten. Under concurrent editing, a peer's edit to `"x"` would land on what is now `"w"`. That is the index-addressing failure described in [Array-like CRDTs §1](array-like-crdts.md).

Two JS facts set the limits for any identity carried _on_ the object. The probe confirms both:

- `structuredClone` serializes only `EnumerableOwnProperties(value, key)`, which yields string keys only. Symbol-keyed and non-enumerable properties do not survive. [HTML structured serialize][html-structured] [ECMA-262 EnumerableOwnProperties][ecma-enumerable]
- Object spread copies own _enumerable_ properties, symbols included, and drops non-enumerable ones. [MDN spread][mdn-spread] [ECMA-262 CopyDataProperties][ecma-copydata]

Probe output: `structuredClone({a, [sym], $cid(non-enum)})` keeps `['a']`, spread keeps `['a', Symbol(id)]`, and spread of a non-enumerable symbol keeps `['a']`. `structuredClone` does keep aliasing (`[f, f]` comes back as two references to one copy), which is why `RowIdentity.transfer` can walk source and clone in lockstep.

## 2. Automerge: proxies during `change()`, hidden object IDs on snapshots

**Mechanism.** Every Automerge map, list, and text object has an object ID (`ObjID`), and every list element has an element ID. "Every element in a list has an ID and operations on the list reference these IDs". An index in an operation means "the ID of the element at index x at the time the operation was created". [Automerge merge rules][am-merge]

Two representations carry that ID:

- **Materialized snapshot.** The Wasm exporter defines `Symbol.for("_am_objectId")` on each exported object with `writable: false, enumerable: false, configurable: false` and freezes the object when the document is in freeze mode ([`export_cache.rs` L22][am-export-sym], [L42-L51][am-export-def], [L251-L278][am-export-wrap], [L345-L356][am-export-hidden]). The JS side reads the same symbol ([`constants.ts` L5][am-constants]), and `getObjectId(doc, prop?)` returns it ([`implementation.ts` L1079][am-getobjectid]).
- **Inside `change(doc, fn)`.** The callback receives proxies, not the snapshot. The map and list proxies answer `OBJECT_ID` with the bound object ID ([`proxies.ts` L258][am-proxy-objid]), and every write becomes an operation on that object. `DocHandle.change` in automerge-repo just calls `A.change` ([`DocHandle.ts` L448-L460][amr-change]).

**How identity survives copying.** It does not, and Automerge refuses to pretend otherwise. Assigning an object that already lives in the document throws `Cannot create a reference to an existing document object` ([`proxies.ts` L278][am-proxy-objid-throw]). Assigning a plain copy creates a new object with a new ID. The docs tell users to "make state updates at the most fine-grained level possible" and warn that replacing an object gives "a conflict on the `doc.cards` property" instead of a merge. [Automerge lists][am-lists] The one place that matches by ID is `indexOf`, which compares `searchElement[OBJECT_ID]` ([`proxies.ts` L578][am-proxy-indexof]). Spreading drops the symbol, because it is non-enumerable.

**Moves and nested edits.** There is no list move. Nested edits are expressed by walking proxies, so `doc.rows[2].done = true` resolves `rows[2]` to an element ID at the time of the edit. For strings, `updateText(doc, path, newText)` diffs old against new and emits minimal splices ([`implementation.ts` L1653][am-updatetext]). That is the diff-based fallback applied to a sequence with no usable keys.

**Cost.** A proxy layer on every access inside `change`. Snapshots are cheap to read and carry the ID for free, but only for code that still holds the original object.

## 3. Yjs and its plain-object bridges

**Yjs itself.** `Y.Map` and `Y.Array` are the live objects. Each integrated type knows its `_item` ([`AbstractType.js` L262-L266][y-abstract-item]), whose `ID` is `{ client, clock }` ([`ID.js` L7-L22][y-id]). `toJSON()` produces a plain copy with no back-references at all ([`YArray.js` L227-L229][y-array-tojson]). `Y.Array`'s documented mutators are `insert`, `delete`, `push`, and `unshift`, all index-based, with no move. The docs state that "a shared type can only exist once in a document". [Y.Array docs][y-array-doc]

**SyncedStore.** SyncedStore hands out proxies over Yjs types. It exposes the backing type through a private `INTERNAL_SYMBOL` and `getYjsValue(object)` ([`index.ts` L33, L81][ss-index]). Re-inserting a type that already has a parent throws `Not supported: reassigning object that already occurs in the tree.` ([`array.ts` L45][ss-array-reassign]), and index assignment on arrays throws `array assignment is not implemented / supported` ([`array.ts` L176][ss-array-assign]). So the bridge is "never copy", and moves are impossible.

**valtio-yjs.** valtio-yjs subscribes to valtio's proxy operation log, translates each array op to an index-addressed Yjs `insert`/`delete` ([`index.ts` L287-L327][vy-index]), and normalizes the op stream in `parseProxyOps` ([`parseProxyOps.ts`][vy-parse]). Identity lives in the proxy, and edits are routed by path plus index.

**immer-yjs.** immer-yjs keeps a plain snapshot from `toJSON()`, runs `produceWithPatches`, and replays each Immer patch by path ([`immer-yjs.ts` L134-L141][iy-update]). On a `Y.Array`, a `replace` at an index is `delete(i)` plus `insert(i, …)` ([L114-L116][iy-replace]), so any whole-row replacement loses the Yjs item and any nested state under it. Immer's own array patches compare `copy_[i]` with `base_[i]` index by index and emit `replace` or `add` per index ([`patches.ts` L180-L246][immer-arraypatches]). A reorder therefore becomes a run of index replacements rather than a move. The README itself says its custom `applyPatch` hook "is not functioning properly". [immer-yjs README][iy-readme]

**Takeaway.** Yjs bridges route edits by path and index on the live tree. They are correct for a single writer, but they replay a reorder or a spread-replace as delete plus insert. That is exactly the failure case in §1.

## 4. Loro and loro-mirror: container IDs, a visible-ish `$cid`, and keyed diffs

**Loro.** Every container has a deterministic `ContainerID`: `cid:root-${name}:${type}` for roots, and `cid:${counter}@${peer}:${type}` for containers created by an operation. "The ContainerID is not a random UUID but is deterministically generated based on the container's context." [Loro container ID docs][loro-cid] [`ContainerID` type][loro-dts] `getShallowValue()` materializes a level with nested containers replaced by their ID strings, and `doc.getContainerById(id)` resolves them back [(d.ts, `getShallowValue` / `getContainerById`)][loro-dts]. `toJsonWithReplacer` lets a caller see each `Container` during materialization [(d.ts)][loro-dts]. `LoroList.getIdAt(pos)` exposes an element's op ID [(d.ts)][loro-dts]. `LoroMovableList.move(from, to)` is a real move, which avoids the duplicates that delete plus insert causes under concurrency. [Loro list tutorial][loro-list] [Kleppmann, list move][move]

**loro-mirror.** loro-mirror is the closest analogue to `@nn/store`: a schema, plain immutable state, `setState` with a new state or an Immer recipe, and a diff that turns state into Loro ops.

- Each mirrored `LoroMap` gets a `$cid` property equal to its container ID. It "is never written back to Loro and is ignored by diffs/updates", and is "useful as a stable identifier (e.g., `schema.LoroList(map, x => x.$cid)`)". [README L155-L157][lm-readme-cid] It is installed with `Object.defineProperty(target, "$cid", { value })`, so it is non-enumerable and read-only ([`utils.ts` L189-L196][lm-definecid]).
- Lists take an `idSelector`. "With an `idSelector`, Mirror performs minimal add/update/move/delete; without it, updates are by index." [README L66][lm-readme-list] `schema.LoroMovableList(itemSchema, idSelector)` "emits move ops on reorder". [README L102][lm-readme-list]
- The keyed diff for a plain list keeps the longest increasing subsequence of surviving IDs, and deletes and reinserts the rest ([`diffListWithIdSelector`, L701+][lm-difflist]). The movable diff emits real moves ([`diffMovableList`, L495+][lm-diffmovable]). Both reject `"Duplicate item id in new state"` ([L527][lm-diffmovable-dup]). When no selector is given on a movable list, it falls back to `$cid` if every item has one ([L1015][lm-cidfallback]).
- **The spread problem, documented in source.** "Immer's default `shallowCopy` is `{ ...base }`, which copies enumerable own properties only, so any object Immer touches during a draft mutation silently loses its `$cid`." The consequence: "a list item whose `$cid` vanished no longer matches the `(item) => item.$cid` idSelector, so `diffMovableList` emits `delete` + `insert` … If a remote peer concurrently deletes the original container, the re-inserted one survives the merge and the logically-removed item comes back." The fix is a private `new Immer({ autoFreeze: false, useStrictShallowCopy: true })` ([`immer-instance.ts` L1-L25][lm-immer]), followed by a pass that re-locks `$cid` descriptors on every object Immer copied ([`hardenCidDescriptors`, `utils.ts` L217+][lm-harden]).

**Takeaway.** A hidden ID works only while every copy goes through code the library controls. A user's own `{ ...row }` still loses it. That is why loro-mirror recommends an explicit `idSelector`, and why it offers `$cid` as only one possible selector.

## 5. Node-identity trees: MobX-State-Tree

MST keeps a tree of live nodes. `getSnapshot` returns immutable, structurally shared snapshots, and `applySnapshot` reconciles a plain value back onto the tree.

- Array reconciliation walks old nodes and new values. On a mismatch it scans forward for a node that `areSame` as the new value and splices it into place, which turns a reorder into reuse of the same node ([`reconcileArrayChildren`, `array.ts` L484-L555][mst-reconcile-array]).
- `areSame(oldNode, newValue)` returns true when the value is the same live node, **or** when `oldNode.snapshot === newValue`, which is reference identity with the node's own last snapshot. Failing both, it returns true when the value is a plain object of the right type with the same identifier attribute ([`array.ts` L604-L640][mst-aresame]).
- The docs: "When applying snapshots, MST will always try to reuse existing object instances for snapshots with the same identifier (see `types.identifier`)." and "In arrays, items without an identifier are never reconciled." [MST reconciliation][mst-reconcile-doc]

That is the closest published precedent to `@nn/store`: the snapshot-reference check is the `RowIdentity` WeakMap, and the identifier check is the schema-declared key recommended in §8. MST layers the two in that order.

## 6. Systems where identity is just data

**Jazz.** CoValues are live objects with `$jazz.id`. `CoList.$jazz.applyDiff(result)` is the plain-array bridge: "Changes are detected using `Object.is` for non-collaborative values and `$jazz.id` for collaborative values". It runs a Myers diff (`calcPatch` from `fast-myers-diff`) and applies the resulting splices ([`coList.ts` L858-L901][jazz-applydiff]). Moves therefore become delete plus insert, but nested CoValues keep their identity whenever the same reference or ID reappears.

**TinyBase.** There are no arrays of rows. `Tables = {[tableId]: Table}` and `Table = {[rowId]: Row}`, written with `setRow(tableId, rowId, row)` or `addRow(tableId, row)`, which returns the generated ID. Order is a query (`getSortedRowIds`) rather than state. [TinyBase store types][tinybase-dts] The materialized value _is_ keyed by identity, so a copy cannot lose it.

**Replicache.** The client view is "an ordered map of key/value pairs", and writes go through mutators, which are "a named JavaScript function that operates on Replicache". [Replicache: how it works][replicache] Identity is the key, and edits are intent-named operations rather than diffs.

**Legend-State.** When an observable array is set, Legend-State builds a map of the previous children by ID to compute moves ([`ObservableObject.ts` L180-L184][legend-move]). It finds the ID field by convention: `id`, then `key`, `_id`, `__id`, or a `<field>_keyExtractor` function ([`findIDKey`, `globals.ts` L220-L245][legend-findid]).

**React.** React itself is an analogy, not a CRDT. "Keys tell React which array item each component corresponds to … This becomes important if your array items can move", "do not generate keys on the fly", and "If your data is coming from a database, you can use the database keys/IDs". Without a key, React falls back to the index. [React: rendering lists][react-keys] The mechanism is covered in [React reconciliation §4](react-reconciliation.md).

## 7. Comparing the bridges

| Bridge                                  | Survives `structuredClone` | Survives `{...row}`           | Survives JSON / rebuilt row | Can detect moves     | Cost                                                   | Used by                                                                   |
| --------------------------------------- | -------------------------- | ----------------------------- | --------------------------- | -------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- |
| Live object / proxy                     | n/a (no copy)              | no: copy is a new object      | no                          | only with a move API | proxy per access; no plain snapshot during edits       | Yjs, SyncedStore, Automerge `change`, valtio-yjs, Jazz                    |
| Hidden symbol / non-enumerable field    | no                         | no (yes if enumerable symbol) | no                          | yes, while intact    | free on read; library must control every copy          | Automerge snapshots, loro-mirror `$cid`                                   |
| WeakMap side table (reference identity) | only with a parallel walk  | no                            | no                          | yes, while intact    | WeakMap entry per object; full walk per clone          | `@nn/store` `RowIdentity`, MST `oldNode.snapshot === newValue`            |
| Declared key in the data + keyed diff   | yes                        | yes                           | yes                         | yes                  | key field in user data; uniqueness must be enforced    | MST `types.identifier`, loro-mirror `idSelector`, Legend, TinyBase, React |
| Index / path patches                    | yes                        | yes                           | yes                         | no                   | none, but routes concurrent edits to the wrong element | immer-yjs, Immer patches, JSON Patch [RFC 6902][rfc6902]                  |
| Sequence diff (LCS / Myers)             | yes                        | yes                           | yes                         | no (delete+insert)   | O(n·d) per array                                       | Jazz `applyDiff`, Automerge `updateText`                                  |

## 8. What this means for `@nn/store`

### Recommendation 1: a schema-declared row key becomes the element key

Add a key declaration to arrays of objects, for example `array(ticket).keyBy("id")`, or a property-level marker. Store it as a custom keyword on the JSON Schema output, in line with [ADR-01](../../decisions/ADR-01-adopt-json-schema-as-the-schema-format.md). Then:

- `createEntity` uses `row[keyField]` as the `RGA` element key instead of `ID.create()` ([`entities.ts`][nn-entities] `buildItems`). The value is still a UUID by convention ([ADR-02](../../decisions/ADR-02-use-uuid-v4-for-generated-identities.md)), but the application mints it, as the example app already does with `crypto.randomUUID()`.
- `prepareRows` resolves `existing = collection.find(row[keyField])` instead of `identities.keyOf(row, collection)` ([`reconcile.ts:84-86`][nn-reconcile]). The duplicate check at L88 stays and becomes the guard against copy-and-push mistakes, as in loro-mirror's `Duplicate item id`.
- Treat the key field as immutable. Changing it means remove plus insert, which mirrors how MST treats identifiers.

**What it fixes.** Spread-replace, `structuredClone`, JSON round-trips, and rows rebuilt from server data all match correctly. `RowIdentity.clone`'s parallel walk and `normalize`'s `identities.copy` become unnecessary for keyed arrays. React gets a correct `key` for free. Today the example app models `ticket.id` as a separate `LWWRegister` beside a hidden RGA key, so it carries two identities for one row ([`apps/example-react/src/store.ts`][nn-example-store]).

**What it costs.** The key becomes visible, user-owned data. Two replicas that create rows with the same key are now the same row: `RGA` merges a second live row under a key into the first ([ADR-11](../../decisions/ADR-11-defer-the-ordering-crdt.md)). That is correct for UUIDs and surprising for natural keys such as an email address. It is also a public schema API change, so it needs a Changeset.

### Recommendation 2: keep `RowIdentity`, but only as the fallback

For arrays of objects with no declared key, keep the WeakMap. It is MST's `oldNode.snapshot === newValue` tier, and it costs nothing for users who mutate rows in place. Document it honestly: a copied row is a new row. Alternatively, follow MST's documented rule ("items without an identifier are never reconciled") and require a key on arrays of objects. That shrinks `reconcile.ts` and removes `RowIdentity` entirely. Either way, the "move" error in the spread-replace case from §1 should turn into either a correct match (keyed) or a clear error that names the missing key.

### Recommendation 3: stop cloning the whole state per update

`State.draft()` runs `structuredClone` over every root field and then walks it again to transfer identities ([`State.ts:89`][nn-state], [`RowIdentity.ts:30-47`][nn-rowidentity]). That costs O(state) per `update`, even when the recipe touches one cell. A copy-on-write draft such as Immer's `produce` copies only the paths that are written ([`shallowCopy`, `common.ts` L213-L252][immer-shallowcopy]). With a draft, `original(draft)` returns the base object that is already in the WeakMap ([`common.ts` L82][immer-original]), so no transfer walk is needed. Untouched subtrees keep their identity, so the reconciler can skip any subtree whose reference is unchanged, the way loro-mirror's `if (oldState === newState) return` does ([`diff.ts` L495+][lm-diffmovable]). If identity stays on the object (Recommendation 2) rather than in data, the loro-mirror lesson applies: Immer's default shallow copy drops non-enumerable properties, which is why loro-mirror runs `useStrictShallowCopy: true` ([`immer-instance.ts`][lm-immer]). A WeakMap keyed by `original()` avoids that problem entirely.

### Recommendation 4: make primitive arrays explicit

Index matching ([`reconcile.ts:56-62`][nn-reconcile]) rewrites every register after an `unshift` (§1). Pick one of these:

- **Diff-based.** Run an LCS or Myers diff of old against new values and emit only remove and push operations for the changed span, as Jazz `applyDiff` and Automerge `updateText` do. Concurrent edits to unchanged elements are then preserved.
- **Document index semantics.** Treat a primitive array as one value: replace the whole `LWWRegister` holding the array, rather than an `RGA` of registers. That is honest about last-writer-wins and cheaper.

### Moves

With keys, `prepareRows` can compute moves the same way loro-mirror and React do: keep the longest increasing subsequence of old indices and treat the rest as moved. That turns today's blanket `unsupported("move")` into a precise error for "a moved row", or into remove plus insert under the same key. The keyed list from [ADR-11](../../decisions/ADR-11-defer-the-ordering-crdt.md) does not converge order anyway, so remove plus insert costs nothing extra today. When the ordering CRDT returns ([ADR-03](../../decisions/ADR-03-use-rga-for-collection-row-order.md)), a move should become a first-class operation rather than delete plus insert, because delete plus insert duplicates under concurrent moves. [Kleppmann, list move][move] [Loro list tutorial][loro-list]

### What not to do

- **Hidden symbols or non-enumerable fields on snapshots.** `structuredClone` drops them (§1), so they would need the same transfer walk `RowIdentity` already does, and user spreads still lose them. loro-mirror shows how much hardening this needs even when the library owns the Immer instance.
- **Live proxies instead of snapshots.** This conflicts with the frozen-snapshot contract that `@nn/react` relies on through `useSyncExternalStoreWithSelector` ([`packages/react/src/index.ts`][nn-react]), and SyncedStore shows the resulting restrictions: no index assignment and no reinsertion.
- **Path and index patches (Immer / JSON Patch) as the wire format.** They are fine as a local transport, but they must be resolved to element keys at prepare time, as Automerge does when it creates an operation. They should never be stored or synced in index form.

[nn-state]: ../../../packages/store/src/State.ts
[nn-view]: ../../../packages/store/src/View.ts
[nn-rowidentity]: ../../../packages/store/src/RowIdentity.ts
[nn-reconcile]: ../../../packages/store/src/reconcile.ts
[nn-normalize]: ../../../packages/store/src/normalize.ts
[nn-entities]: ../../../packages/store/src/entities.ts
[nn-react]: ../../../packages/react/src/index.ts
[nn-example-store]: ../../../apps/example-react/src/store.ts
[am-merge]: https://automerge.org/docs/reference/under-the-hood/merge-rules/
[am-lists]: https://automerge.org/docs/reference/documents/lists/
[am-constants]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/constants.ts#L5
[am-export-sym]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/rust/automerge-wasm/src/export_cache.rs#L22
[am-export-def]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/rust/automerge-wasm/src/export_cache.rs#L42-L51
[am-export-wrap]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/rust/automerge-wasm/src/export_cache.rs#L251-L278
[am-export-hidden]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/rust/automerge-wasm/src/export_cache.rs#L345-L356
[am-getobjectid]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/implementation.ts#L1079
[am-updatetext]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/implementation.ts#L1653
[am-proxy-objid]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/proxies.ts#L258
[am-proxy-objid-throw]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/proxies.ts#L278
[am-proxy-indexof]: https://github.com/automerge/automerge/blob/5bae7757ef7b92c8cd6850def388f22767305ccb/javascript/src/proxies.ts#L578
[amr-change]: https://github.com/automerge/automerge-repo/blob/3ab7c33bbc628769e101691e0c32ef4f0c220d5c/packages/automerge-repo/src/DocHandle.ts#L448-L460
[y-abstract-item]: https://github.com/yjs/yjs/blob/d9b829bedd93cfbb4ee17bbf4fc12dd1f7795877/src/types/AbstractType.js#L262-L266
[y-id]: https://github.com/yjs/yjs/blob/d9b829bedd93cfbb4ee17bbf4fc12dd1f7795877/src/utils/ID.js#L7-L22
[y-array-tojson]: https://github.com/yjs/yjs/blob/d9b829bedd93cfbb4ee17bbf4fc12dd1f7795877/src/types/YArray.js#L227-L229
[y-array-doc]: https://docs.yjs.dev/api/shared-types/y.array
[ss-index]: https://github.com/YousefED/SyncedStore/blob/7234609d083baf07c866aa753690acded567facc/packages/core/src/index.ts#L33-L85
[ss-array-reassign]: https://github.com/YousefED/SyncedStore/blob/7234609d083baf07c866aa753690acded567facc/packages/core/src/array.ts#L45
[ss-array-assign]: https://github.com/YousefED/SyncedStore/blob/7234609d083baf07c866aa753690acded567facc/packages/core/src/array.ts#L176
[vy-index]: https://github.com/valtiojs/valtio-yjs/blob/17ca0d7f81b4495228644abd11a9a4bcd5314b93/src/index.ts#L287-L327
[vy-parse]: https://github.com/valtiojs/valtio-yjs/blob/17ca0d7f81b4495228644abd11a9a4bcd5314b93/src/parseProxyOps.ts
[iy-update]: https://github.com/sep2/immer-yjs/blob/4288b206b6aec7c39f42fb5d30cc6993c587cf06/packages/immer-yjs/src/immer-yjs.ts#L134-L141
[iy-replace]: https://github.com/sep2/immer-yjs/blob/4288b206b6aec7c39f42fb5d30cc6993c587cf06/packages/immer-yjs/src/immer-yjs.ts#L114-L116
[iy-readme]: https://github.com/sep2/immer-yjs/blob/4288b206b6aec7c39f42fb5d30cc6993c587cf06/README.md
[immer-arraypatches]: https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/plugins/patches.ts#L180-L246
[immer-shallowcopy]: https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/utils/common.ts#L213-L252
[immer-original]: https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/utils/common.ts#L82
[loro-cid]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/advanced/cid.mdx
[loro-list]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/tutorial/list.mdx
[loro-dts]: https://unpkg.com/loro-crdt@1.17.1/bundler/loro_wasm.d.ts
[lm-readme-list]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/README.md#L66-L111
[lm-readme-cid]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/README.md#L155-L157
[lm-definecid]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/utils.ts#L189-L196
[lm-harden]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/utils.ts#L198-L217
[lm-immer]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/immer-instance.ts#L1-L25
[lm-diffmovable]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L495-L560
[lm-diffmovable-dup]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L527
[lm-difflist]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L701-L800
[lm-cidfallback]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L1015
[mst-reconcile-array]: https://github.com/mobxjs/mobx-state-tree/blob/c08d848d6a71407553e53ffc274f72a57130d6a2/src/types/complex-types/array.ts#L484-L555
[mst-aresame]: https://github.com/mobxjs/mobx-state-tree/blob/c08d848d6a71407553e53ffc274f72a57130d6a2/src/types/complex-types/array.ts#L604-L640
[mst-reconcile-doc]: https://github.com/mobxjs/mobx-state-tree/blob/c08d848d6a71407553e53ffc274f72a57130d6a2/docs/concepts/reconciliation.md
[jazz-applydiff]: https://unpkg.com/jazz-tools@0.20.19/src/tools/coValues/coList.ts
[tinybase-dts]: https://unpkg.com/tinybase@10.0.1/@types/store/index.d.ts
[replicache]: https://doc.replicache.dev/concepts/how-it-works
[legend-findid]: https://github.com/LegendApp/legend-state/blob/4818e7f4417b44a6c1645dce2ab64ae1aa5f054c/src/globals.ts#L220-L245
[legend-move]: https://github.com/LegendApp/legend-state/blob/4818e7f4417b44a6c1645dce2ab64ae1aa5f054c/src/ObservableObject.ts#L180-L184
[react-keys]: https://react.dev/learn/rendering-lists
[rfc6902]: https://www.rfc-editor.org/rfc/rfc6902
[move]: https://martin.kleppmann.com/2020/04/27/papoc-list-move.html
[html-structured]: https://html.spec.whatwg.org/multipage/structured-data.html#structuredserializeinternal
[ecma-enumerable]: https://tc39.es/ecma262/#sec-enumerableownproperties
[ecma-copydata]: https://tc39.es/ecma262/#sec-copydataproperties
[mdn-spread]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax
