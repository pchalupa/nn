# How Loro writes state updates back to the CRDT

Researched 2026-10-29 against **`loro-crdt` 1.17.1**, the version under npm's `latest` tag, published 2026-10-22. Its tag `loro-crdt@1.17.1` resolves to **`6114e10e631631f6faf060fbda4d9676a42240d1`**, the same commit as the package's `gitHead`. The binding library is **`loro-mirror` 2.3.3**, the npm `latest` version, published 2026-09-10. Its tag `loro-mirror-v2.3.3` resolves to **`97fd2f0f79aa797e16829435b08727cd6212787b`**. The documentation site's source, `loro-dev/loro-docs`, has no release tags, so its links pin the head read for this note, **`fed85892aa01718072a862d29c48077d427a4e02`** (2026-10-22). Source links below use these commits rather than `main`. [npm `loro-crdt`][npm-loro] · [npm `loro-mirror`][npm-mirror] · [Loro tag][loro-tag] · [Mirror tag][mirror-tag]

## Short answer and terminology

**Core Loro has no "set the document to this JSON" API.** Every write is a method call on a container, such as `map.set`, `list.insert`, `movable.move` or `text.insert`. Each call becomes one or more ops in a pending transaction, and a commit groups them into a single **Change**. The bulk APIs use the same handlers. `applyDiff` takes a container-keyed batch of deltas and replays it as fresh local ops. `revertTo` is `diff` followed by `applyDiff`. `importJsonUpdates` is not a state write at all: it imports op-level history, IDs included, the same way `import` does. [Handler `apply_diff`][h-apply-diff] · [`revert_to`/`diff`/`apply_diff`][loro-revert-diff-apply] · [`import_json_updates`][loro-import-json]

**Turning plain application state into ops is the job of `loro-mirror`.** It is the first-party library for this. `setState` produces the next immutable state with Immer and diffs it against the previous one, guided by a schema. The diff produces a list of per-container `Change` records. Mirror applies them through ordinary container methods and then calls `doc.commit()` once. Remote events take the reverse path: they are applied to the state as deltas. A `syncing` flag stops Mirror's own commit from echoing back into the state. [`setState`][m-setstate] · [`updateLoro`/`applyChangesToLoro`][m-update-loro] · [`handleLoroEvent`][m-handle-event] · [Mirror blog post][blog-mirror]

| Term                    | Meaning in this note                                                                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Op**                  | An atomic edit with ID `(peer, counter)` and a Lamport timestamp. [Operations and changes][doc-ops]                                                                               |
| **Change**              | A run of consecutive ops from one peer, with deps, timestamp and optional message. A commit creates one or extends the previous one. [Operations and changes][doc-ops]            |
| **Transaction (txn)**   | The pending buffer of local ops. It controls event batching, not ACID semantics. [Transaction model][doc-txn]                                                                     |
| **Commit**              | Turns the txn's ops into a Change, records it in the OpLog, and emits events. It can be explicit or implicit. [Commit docs][w-commit]                                             |
| **Handler / container** | The object you write through. It is either _detached_ (standalone, not in a doc) or _attached_. [Attached/detached][doc-attached] · [`MaybeDetached`][h-maybe]                    |
| **OpLog / DocState**    | History versus the materialized current state. [OpLog and DocState][doc-oplog]                                                                                                    |
| **Diff / event**        | A container-keyed delta such as `{type:"map", updated}` or `{type:"list", diff}`. Events carry it, `doc.diff` returns it, and `applyDiff` consumes it. [Diff types][w-diff-types] |

**Public contract versus implementation.** The public contract consists of the container methods, `commit` and its options, the implicit-commit triggers, synchronous events since 1.8, and the documented behavior of `diff`/`applyDiff`/`revertTo`/`importJsonUpdates`. Internal details are `Transaction`, `EventHint`, `change_to_diff`, change-store merging, and Mirror's private diff functions and flags. They describe these pinned versions and are not APIs to depend on. Mirror's `diffContainer` and the list diffs are internal: the package entry re-exports only `Mirror`, `UpdateSource`, `toNormalizedJson`, types and the schema API. [Event docs][doc-event] · [Mirror README API][m-readme-api] · [Mirror package exports][m-index]

## 1. The core mutation path

### Every write goes through a handler and the current txn

JS container objects wrap Rust handlers. A handler is either `Detached`, holding a plain in-memory value, or `Attached`, pointing at a container index in a doc. On an attached handler, a write runs inside `with_txn`, which borrows the doc's current transaction. Native Rust starts an auto-commit txn lazily. On wasm, a missing txn is an error (`AutoCommitNotStarted`), so the JS `LoroDoc` constructor starts auto-commit up front. In JS there is therefore always a pending txn to write into. [`MaybeDetached`][h-maybe] · [`with_txn`][h-with-txn] · [wasm constructor][w-new]

### What one op does, in order

`Transaction::apply_local_op` is where every local write lands. [Implementation][txn-apply-local-op]

1. **Allocate identity.** The op gets ID `(peer, next_counter)` and the txn's `next_lamport`.
2. **Apply to DocState immediately.** `state.apply_local_op` mutates the materialized state before any commit. It first creates child containers referenced by the op and records parent links. [State `apply_local_op`][state-apply-local-op]
3. **Advance the version.** The DAG version is updated as a pending local op, and `state.frontiers` moves to the op's last ID.
4. **Record an event hint, not a diff.** A per-container `EventHint` is stored and merged with the previous hint when adjacent, for example consecutive text inserts. The op itself goes into `local_ops`.

Local edits are therefore **readable at once but not yet observable as events**. The docs say this too: uncommitted ops "directly update the version" but are not in the OpLog until commit. A runtime check on 1.17.1 found that after `m.set("a", 1)`, `toJSON()` already showed the value while `getPendingTxnLength()` was 1 and no event had fired. [Event docs aside][doc-event-aside] · [Pending length][w-pending]

### What commit does

`Transaction::_commit`: [Implementation][txn-commit]

1. **An empty txn aborts.** No Change is created. Pending options are returned to the caller instead.
2. **Build one Change.** It contains the txn's ops, `deps` equal to the frontiers when the txn began, ID `(peer, start_counter)`, the start Lamport, a timestamp clamped to be non-decreasing, and the commit message.
3. **Run pre-commit hooks.** `subscribePreCommit` callbacks can modify the change's metadata through a `ChangeModifier` before it is stored.
4. **Derive the event diff from hints.** `change_to_diff` combines ops with their hints, so a local commit does not recompute a diff from state. [`change_to_diff`][txn-change-to-diff]
5. **Store and publish.** `oplog.import_local_change` inserts the change. `state.commit_txn` records the diff for event emission. The `on_commit` closure emits the events and then, if anyone subscribed, exports the committed span's bytes to `subscribeLocalUpdates`. That is the hook applications use to ship local edits to peers. [`on_commit` closure][txn-on-commit] · [State `commit_txn`][state-commit-txn]

Storage merges consecutive local changes. A new change joins the previous block when it is from the same peer, its counter is contiguous, its only dep is that peer's previous op, its timestamp is within the merge interval (default **1000 s**), and its commit message is the same. Two explicit commits in the check above produced one stored Change. The docs list the same conditions: cross-peer dependency, time gap, or a different message start a new Change. [`can_merge_right`][change-merge] · [Change store][change-store-merge] · [Merge interval][loro-merge-interval] · [Operations and changes][doc-ops]

### Implicit versus explicit commit

| Trigger                                                                                                       | Kind     | Empty-txn options                                                      |
| ------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `doc.commit({ origin, message, timestamp })`                                                                  | Explicit | Swallowed, not carried over                                            |
| `export`, `import`, `checkout`, plus barrier calls such as `diff`, `revertTo`, `fork` and `importJsonUpdates` | Implicit | `message`/`timestamp` carry over to the next commit; `origin` does not |

`applyDiff` is not a barrier. It writes into the current pending txn, which keeps its ops pending until the next commit. [Apply-diff scope][loro-revert-diff-apply] · [Barrier call sites][loro-barriers]

`origin` labels the event and is **not persisted**. `message` is persisted and synced. Since `loro-crdt@1.8.0`, events fire **synchronously** during the commit cycle. Before that, they needed a microtask. The JS wrapper implements this by decorating `commit`, `import`, `applyDiff`, `revertTo`, `diff` and others to drain the pending-event queue in a `finally`. [Commit docs][w-commit] · [Implicit/explicit commit][loro-implicit-commit] · [Event docs][doc-event] · [JS decoration][w-decorate] · [Pending queue][w-pending-queue]

The docs describe transactions as "NOT database ACID transactions" with "no rollback": a failed op does not undo earlier ones. **1.17.1 adds a narrower guarantee.** `applyDiff`, and `revertTo` through it, run inside a rollback scope. If they fail, the doc, its history and its subscribers return to their state before the call, and uncommitted edits made before the call are kept. This guarantee is stated in the Rust doc comment and implemented with `begin_rollback_scope`, not on the docs site. Ordinary container calls still have no rollback. [Transaction model][doc-txn] · [`apply_diff` atomicity][loro-revert-diff-apply] · [Rollback scope][txn-struct]

## 2. Container write semantics that matter for write-back

Merge policies are covered in [map-object-crdts.md](./map-object-crdts.md) and [array-like-crdts.md](./array-like-crdts.md). This table covers only what a write-back layer needs to know.

| Write                                      | What it records                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map.set(k, v)`                            | A `MapSet` op. **Skipped when the current value already equals `v`** (`getPendingTxnLength()` stayed 0 in the check). `applyDiff` uses an internal variant that never skips. [`insert_with_txn`][h-map-insert] · [`insert_without_skipping`][h-map-insert-noskip]                                                                                                                                                     |
| `map.set(k, {x: 1})`                       | Stores the object as **one opaque value**, not a nested map, so concurrent sub-field edits do not merge. Verified at runtime: the value is not a container. [`insert_with_txn`][h-map-insert]                                                                                                                                                                                                                         |
| `map.delete(k)`                            | A `MapSet` with `value: None`. [`delete_with_txn`][h-map-delete]                                                                                                                                                                                                                                                                                                                                                      |
| `map.setContainer(k, new LoroMap())`       | A `MapSet` whose value is a new container ID derived from **the op's own ID**, after which the child's content is replayed as ops. Setting an _already attached_ container copies its content into a new ID. The check confirmed both, and that the original detached object stays detached. [`insert_container_with_txn`][h-map-insert-container] · [Map `attach`][h-map-attach] · [Attached/detached][doc-attached] |
| `map.ensureMergeable*(k)`                  | A child ID derived from parent, key and type, so independent creation converges. See [map-object-crdts.md §5](./map-object-crdts.md#loro-exposes-both-identity-choices).                                                                                                                                                                                                                                              |
| `text.update(s)` / `updateByLine(s)`       | Computes a Myers diff from the current string and emits only the needed inserts and deletes. Changing `"hello world"` to `"hello brave world"` produced one `insert "brave "` at 6. The doc comment warns it is slow above about 50,000 characters and recommends `updateByLine`. [Rust `update`][h-text-update] · [JS `update` docs][w-text-update]                                                                  |
| `text.applyDelta(delta)`                   | Applies a Quill-style delta. Inserted text loses any inherited style that the delta omits. [Text tutorial][doc-text-delta]                                                                                                                                                                                                                                                                                            |
| `movable.set(i, v)` / `movable.move(a, b)` | Identity-preserving value replacement and move. A plain `List` can only delete and reinsert. [array-like-crdts.md][array-note]                                                                                                                                                                                                                                                                                        |

## 3. Bulk and diff-based writes

### `doc.diff(from, to)` produces the input format

`diff` validates both frontiers, implicitly commits, checks the state out to `from`, records the events produced by checking out to `to`, then restores the original version. The JS result is an array of `[ContainerID, Diff]` sorted so that a child's creation comes before its use. By default (`for_json = true`) container references appear in the `JsonDiff` form, which serializes cleanly. `Diff` is a union of `ListDiff`, `TextDiff`, `MapDiff`, `TreeDiff` and `CounterDiff`, the same shapes events carry. A diff is squashed: an insert later deleted inside the range does not appear. [`diff_events`][loro-revert-diff-apply] · [JS `diff`][w-diff] · [Diff types][w-diff-types] · [Tips: diff + applyDiff][doc-tips-diff]

### `applyDiff(batch, { fullState? })` lowers deltas back to handler calls

`LoroDoc::_apply_diff` resolves each entry's container, follows a remap table, skips containers that are unreachable, and calls `Handler::apply_diff`. That function turns each diff into ordinary local ops in the current txn: [`_apply_diff`][loro-apply-diff-inner] · [`Handler::apply_diff`][h-apply-diff]

| Diff                         | Lowered to                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map `updated[k] = value`     | `insert_without_skipping`, so the value is written even if it is equal                                                                                                                                                           |
| Map `updated[k] = undefined` | `delete`                                                                                                                                                                                                                         |
| Map `updated[k] = container` | A **new** container under `k`, with `old id → new id` recorded in the remap so that the child's own entry later in the batch targets it. Mergeable IDs are recomputed deterministically. [Container value][h-map-container-diff] |
| Text delta                   | `TextHandler::apply_delta`                                                                                                                                                                                                       |
| List delta                   | Retain/delete/insert walk. Each inserted container becomes a fresh container plus a remap entry. [List `apply_delta`][h-list-apply-delta]                                                                                        |
| MovableList delta            | A three-pass plan. **A delete and an insert of the same child container in one delta become a `move`**, keeping the child's identity. [MovableList `apply_delta`][h-movable-apply-delta]                                         |
| Tree create/move/delete      | `create`/`move`/`delete`, checking whether the target node is still alive (re-create versus move back). [Tree branch][h-apply-diff]                                                                                              |
| Counter `increment`          | `increment(delta)`                                                                                                                                                                                                               |

The JS docs state the remapping rule directly: containers created in the source "will be assigned fresh IDs in the target document". `fullState: true` is only for `doc.diff()` output applied to a doc that may hold hidden state for a revived mergeable child. The option docs warn never to use it for events from local commits. [JS `applyDiff`][w-apply-diff] · [`ApplyDiffOptions`][w-apply-diff-options]

**`applyDiff` replays; it does not merge.** The ops it creates are new local ops with this peer's IDs, so applying the same batch twice applies it twice. In the check, a `["x"]` list diff applied twice to an empty doc gave `["x","x"]`. A nested map's ID came out as `cid:1@3:Map` in the target, against `cid:1@1:Map` in the source. The ops sit in the pending txn until a commit like any other local edit. This follows from the lowering above and was confirmed at runtime. The docs do not state it as a contract.

### `revertTo(frontiers)`

`revert_to` computes `diff_events(current, target)` in a changes-only mode and applies the result through the same all-or-nothing path. The doc stays **attached** and gains new forward ops, unlike `checkout`. In the check, reverting `"abcdef"` to `"abc"` produced 3 new delete ops and `isDetached() === false`. [`revert_to`][loro-revert-diff-apply] · [JS `revertTo`][w-revert] · [API docs][doc-api-revert]

### `importJsonUpdates` / `exportJsonUpdates`

These export and import **op-level changes** (peer, counter, Lamport, deps, ops) as JSON rather than bytes. Import decodes them into changes and runs the normal import path, so the ops keep their original IDs and merge idempotently like binary updates. This is not a way to write a JSON _state_. The JSON schema guarantees backward compatibility only. [`import_json_updates`][loro-import-json] · [JS binding][w-import-json]

### What is missing

Inference from the API surface above: Loro has no built-in "make this container equal to this plain value" operation for maps or lists. `text.update` is the only target-value API, and it covers text only. Diffing a plain target value into container ops is what `loro-mirror` adds.

## 4. `loro-mirror`: plain state to container ops

### The `setState` pipeline

1. **Produce next state.** A function updater runs under a **private Immer instance** with `autoFreeze: false` and `useStrictShallowCopy: true`. The updater may mutate the draft or return a new object. An object updater is shallow-merged. The strict copy exists to preserve the non-enumerable `$cid` property. [`setState`][m-setstate] · [Immer instance][m-immer]
2. **Validate.** If `validateUpdates` is set (the default), the whole new state is checked with `validateSchema` and an error is thrown on failure. [`setState`][m-setstate]
3. **Diff.** `diffContainer(doc, this.state, newState, "", schema)` walks from the root and returns `Change[]`. It reads the doc only to find existing child container IDs. [`updateLoro`][m-update-loro] · [`diffContainer`][m-diff-container]
4. **Apply.** Changes are grouped by container ID. Root keys use `doc.getMap/getList/...`. Other changes use `doc.getContainerById` and are dispatched per kind. [`applyChangesToLoro`][m-apply-changes] · [`applyContainerChanges`][m-apply-container]
5. **Commit once.** If any change was applied, `doc.commit({origin, timestamp, message})` runs, built from `SetStateOptions`. One `setState` is one commit, which became one Change in the check. Storage may still merge it with neighboring commits as described in §1. [`applyChangesToLoro`][m-apply-changes]
6. **Adopt and notify.** `baseState = stripUndefined(newState)`. Subscribers receive `{ source: "MIRROR", tags }`. [`setState`][m-setstate]

The `Change` kinds are `insert`, `insert-container`, `delete`, `move`, `set`, `set-container`, `tree-create`, `tree-move` and `tree-delete`. Each carries its target container and a key or index. [Change types][m-change-types]

### Map diff

For each key: [`diffMap`][m-diff-map]

- **Removed key, or a key now `undefined`:** `delete`. `$cid` and `schema.Ignore()` fields are skipped.
- **New key:** `insert-container` if the schema type, or inference from the value, says this is a container. Otherwise `insert` with the schema's `transform.encode` applied.
- **Changed key** (`oldItem !== newItem`): if both values are containers of the same type, recurse into the existing child container by ID and reattach `$cid` if it is missing. Otherwise compare with the schema's equality strategy (reference by default) and emit a whole-value `insert`.

Change detection relies on **reference inequality**, so the cost depends on Immer's structural sharing: untouched subtrees keep their reference and are pruned without being visited. The blog states the result as roughly O(k·m) for k changed items with m changed fields each. That is the authors' complexity claim and was not benchmarked here. [`diffMap`][m-diff-map] · [Blog][blog-mirror] · [Immer note](./immer-copy-on-write.md)

### List diffs: four strategies

| Schema                                 | Algorithm                                                                                                                                                                                                                                                   | Reorder becomes                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `LoroList` without `idSelector`        | Trims the common prefix and suffix by reference. The overlapping middle is updated in place: recurse if the Loro item is a container, otherwise delete and insert. The remainder is deleted or inserted. [`diffList`][m-diff-list]                          | Index-wise rewrites of the affected range                           |
| `LoroList` with `idSelector`           | Keeps the **longest increasing subsequence** of common IDs. Every other old item is deleted and every other new item inserted. Kept items whose value changed are deep-compared, then recursed into or replaced. [`diffListWithIdSelector`][m-diff-list-id] | **Delete + insert of a new container**; the item's identity changes |
| `LoroMovableList` with `idSelector`    | Deletes (highest index first), then a minimal set of `move`s chosen by LIS with anchor-based target indices, then inserts, then per-item updates: recurse into containers or `set` primitives. [`diffMovableList`][m-diff-movable]                          | **`move` ops**; identity kept                                       |
| `LoroMovableList` without `idSelector` | Index-based fallback, used for inferred movable lists. [`diffMovableListByIndex`][m-diff-container]                                                                                                                                                         | Index-wise                                                          |

Checked on 2.3.3: moving the first of three items to the end produced **one `move` op** on a `LoroMovableList`. On a `LoroList` with `(t) => t.id` it produced `delete`, an `insert` of a new map container, and two key `insert`s that re-filled it. The README recommends `LoroMovableList` for drag-and-drop for this reason. [README lists][m-readme-lists]

### Text and strings

`schema.LoroText()` is mirrored as a plain string. `diffText` emits the whole new string as one change, and the applier calls `text.update(value)`, so **Loro's Myers diff computes the character-level ops**. In the check, `"hello world"` changed to `"hello brave world"` became one `insert "brave "`. A `schema.String()` field is instead a primitive map value, rewritten whole and resolved by last-writer-wins. Without a schema, a string becomes `LoroText` only with `inferOptions.defaultLoroText`. [`diffText`][m-diff-text] · [Text apply][m-apply-text] · [Inference][m-infer]

### Nested container creation

When a map key becomes a container, `insertContainerIntoMap` creates a detached container of the schema's type and attaches it with `map.setContainer`, which gives it a new op-derived ID. It then calls `initializeContainer`, which fills the children recursively and creates further containers as needed. With `mergeableMapChildContainers`, it uses `ensureMergeable*` instead and reuses an existing child of the same type. The new container's ID is stamped onto the pending state object as a non-enumerable `$cid`. All of this runs in the same txn and is committed once. [`insertContainerIntoMap`][m-insert-map] · [Mergeable insert][m-insert-mergeable] · [`initializeContainer`][m-init-container] · [`defineCidProperty`][m-utils-equal]

Without a schema, plain objects become `Map`, arrays become `List` (or `MovableList` with `defaultMovableList`), and `Date`/`RegExp` are treated as values, not maps. Tree and Counter are never inferred. [Inference][m-infer]

### Schema's role

The schema chooses container types, list strategy and `idSelector`, defaults, validation, `transform` encode/decode and equality, and `Ignore` fields. `Ignore` fields are excluded in both directions: the diff skips them, and remote events targeting them are dropped. `ignoreUnknownProperties` mirrors undeclared root keys from newer peers instead of failing validation. [README schema][m-readme-schema] · [README API][m-readme-api] · [Ignore filter][m-handle-event]

### Ephemeral routing

With an `ephemeralStore`, changes that only set a primitive on an existing key of an existing map go to the `EphemeralStore`. Everything else goes to the doc. A debounced `finalizeEphemeralPatches` later commits them to the doc. On this path, Mirror does not trust `newState` for the doc-backed state. It captures the local commit's event and applies it to `baseState`. [README ephemeral][m-readme-ephemeral] · [`applyLocalLoroChanges`][m-apply-local]

## 5. Remote events back into state, and echo avoidance

Mirror subscribes with `doc.subscribe(handleLoroEvent)`. For each batch it drops events for `Ignore` fields, registers newly seen containers, and rewrites event paths to canonical root paths. It then applies the deltas to `baseState` with `applyEventBatchToState`, an Immer `produce` that applies map, list, text and tree deltas in place. Finally it stamps `$cid`s, recomposes the ephemeral overlay, and notifies subscribers with `source: "LORO"`. Remote updates are applied as **deltas, not by re-reading the whole doc**. [Subscription][m-subscribe] · [`handleLoroEvent`][m-handle-event] · [`applyEventBatchToState`][m-event-apply]

**Echoes are suppressed by a re-entrancy flag, not by origin.** `updateLoro` sets `syncing = true` around diff, apply and commit. Since 1.8 the commit's local event is delivered synchronously, inside that window, and `handleLoroEvent` returns immediately while `syncing` is set. The local path then adopts `newState` as the doc-backed state. [`updateLoro`][m-update-loro] · [`handleLoroEvent`][m-handle-event] · [Synchronous events][doc-event]

Consequence, checked on 2.3.3: `setState` also returns early while `syncing` is set, and subscribers to a `LORO` update are notified inside that window. **A `setState` issued from a subscriber during a remote update is silently dropped.** In the check, a subscriber's write of `meta.title` was lost and the doc kept the remote value. This is source behavior, not documented API. [`setState` guard][m-setstate] · [`handleLoroEvent`][m-handle-event]

For comparison, the first-party **`loro-prosemirror` 0.4.4** binding uses origin filtering. It commits editor changes with `origin: "loroSyncPlugin"` and ignores events where `event.by === "local"` unless `origin === "undo"`. Its write-back is also a diff: `lib0`'s `simpleDiff` for text content, a style-only `applyDelta` for marks, and prefix/suffix matching for child nodes. [Write-back][pm-update] · [Text diff][pm-text] · [Children][pm-children] · [Event filter][pm-filter]

## 6. Tradeoffs and edge cases

- **List-item identity is a correctness issue, not only a performance one.** `$cid` is non-enumerable, so `{...item}` drops it. With a `$cid`-based `idSelector`, the rebuilt item then looks new and becomes delete + insert. A concurrent remote delete of the original then no longer removes the item after merge. The check reproduced the op shape: `delete`, container `insert`, key `insert`. Prefer draft mutation or a domain ID. [README `$cid`][m-readme-cid] · [Immer instance rationale][m-immer]
- **Moves on a plain `LoroList` recreate the container, and the mirrored `$cid` can go stale.** In the check, after a reorder the doc held `cid:10@1:Map` at the new position while state still carried `$cid` `cid:0@1:Map`. `checkStateConsistency()` threw `State diverged ($cid mismatch; values are equal)`. Cause, inferred from source: `defineCidProperty` never overwrites an existing `$cid`. Use `LoroMovableList` when items move. [`defineCidProperty`][m-utils-equal] · [`diffListWithIdSelector`][m-diff-list-id]
- **Text versus string.** `LoroText` merges concurrent character edits. A string field is replaced whole. Mirror hides the difference behind the same `string` type, so the choice lives only in the schema or infer options. [`diffText`][m-diff-text] · [Inference][m-infer]
- **Objects as values versus containers.** In core, `map.set(k, obj)` stores an opaque value. Mirror makes plain objects `LoroMap`s by default. Concurrent first creation of the same child under one key is LWW (one child is dropped) unless `mergeableMapChildContainers` is on. That option has its own caveat: identical concurrent text or list writes can appear twice. [README notes][m-readme-api] · [map-object-crdts.md §5](./map-object-crdts.md#5-nested-identity-versus-path-and-whole-value-replacement)
- **Batching.** Pending ops are visible in state at once, but peers and subscribers see them only at commit. One Mirror `setState` is one commit. Core merges adjacent local commits into one stored Change within the merge interval, which affects history granularity and undo grouping, not convergence. [`txn` commit][txn-commit] · [`can_merge_right`][change-merge]
- **`applyDiff` is not idempotent and not a merge.** Use `import`/`importJsonUpdates` to replicate history. Use `applyDiff` for squash-like transfer of a net change, where the target gets new op IDs and new container IDs. [Runtime check](#3-bulk-and-diff-based-writes) · [Tips][doc-tips-diff]
- **Costs to expect.** Mirror's diff is proportional to the changed paths only when references are shared. Kept list items whose reference changed are deep-compared (`deep-equality`). Validation runs over the whole new state on every `setState` unless disabled (an inference from the `validateSchema(newState)` call). `text.update` is a Myers diff, so prefer `updateByLine` for large texts in core. [`valuesEqual`][m-utils-equal] · [`setState`][m-setstate] · [JS `update` docs][w-text-update]
- **The blog post predates 2.3.3.** It uses `SyncDirection.FROM_LORO` and `direction`. The 2.3.3 README uses `UpdateSource` and `source`. Read the README for the current API. [Blog][blog-mirror] · [README API][m-readme-api]

## 7. Relevance to this repository

In the working tree inspected on 2026-10-29, `State.update` clones the projection, runs a synchronous recipe, prepares a snapshot keyed by row identity, and reconciles it into LWW/RGA entities inside a batch. Row identity lives in a `WeakMap` keyed by row object. `prepareRows` throws `unsupported("move")` when the order of existing rows changes. These links describe the uncommitted working tree, not a pinned revision. [State update](../../../packages/store/src/State.ts#L70-L90) · [Row preparation](../../../packages/store/src/reconcile.ts#L71-L102) · [Reconcile](../../../packages/store/src/reconcile.ts#L104-L135) · [Row identity](../../../packages/store/src/RowIdentity.ts#L11-L46)

Inference: this is the same shape as Mirror's `setState`, which diffs a recipe result against current state and lowers it to container writes. Three Mirror lessons transfer directly:

1. Identity carried on the object (`$cid`) is fragile under spread. The `WeakMap` approach has the analogous fragility for rebuilt row objects.
2. Move support needs an identity-preserving list primitive. Delete plus reinsert silently changes identity.
3. Echo suppression by a synchronous re-entrancy flag drops writes issued from subscribers.

[Mirror `$cid` rationale][m-immer] · [`diffMovableList`][m-diff-movable] · [`handleLoroEvent`][m-handle-event]

## 8. Verification and remaining questions

Read the pinned Loro sources (`txn.rs`, `loro.rs`, `handler.rs`, `state.rs`, `change.rs`, the change store, the wasm bindings and `index.ts`), the pinned loro-docs pages, the pinned `loro-mirror` core sources and README, and `loro-prosemirror` at `v0.4.4` (`0e036a9bedb432ea7ae238c82d379e1a2fca11d6`). Installed `loro-crdt@1.17.1` and `loro-mirror@2.3.3` from npm in an isolated scratch directory and ran two scripts on **Node v26.11.1**. The published `loro-mirror` dist contains the `captureLocalDocEvent` and strict-shallow-copy code read at the tag. The npm package has no `gitHead`, so tag-to-tarball identity was checked only by these markers.

The core checks covered: state visible before commit, events only after commit, the same-value `set` no-op, an object stored as an opaque value, two commits merged into one Change, `text.update` op shape, `applyDiff` applied twice, container ID remapping, detached versus attached `setContainer`, and `revertTo` producing new ops on an attached doc. The Mirror checks covered: one commit and one `MIRROR` notification per `setState`, single-field op shape, MovableList versus List reorder ops, text delta, spread-rebuilt `$cid` items, the stale `$cid` after a List move, and the dropped `setState` inside a `LORO` subscriber. These are targeted observations, not the upstream test suites, which were read where cited but not run.

Not covered: Loro's `UndoManager` interaction with Mirror commits, the jotai/react wrappers beyond their package metadata, tree diffing in Mirror (`diffTree`) beyond its change kinds, rich-text marks through Mirror, and performance numbers. No benchmark was run. Behavior of releases after these pins may differ, especially the 1.17 `applyDiff` rollback, which is newer than the docs site's "no rollback" statement.

## Sources

Loro implementation links point at `6114e10e631631f6faf060fbda4d9676a42240d1`, Mirror at `97fd2f0f79aa797e16829435b08727cd6212787b`, docs at `fed85892aa01718072a862d29c48077d427a4e02`, and loro-prosemirror at `0e036a9bedb432ea7ae238c82d379e1a2fca11d6`. The live docs are at [loro.dev/docs](https://loro.dev/docs).

[npm-loro]: https://registry.npmjs.org/loro-crdt/1.17.1
[npm-mirror]: https://registry.npmjs.org/loro-mirror/2.3.3
[loro-tag]: https://github.com/loro-dev/loro/releases/tag/loro-crdt%401.17.1
[mirror-tag]: https://github.com/loro-dev/loro-mirror/tree/loro-mirror-v2.3.3
[array-note]: ./array-like-crdts.md
[doc-txn]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/concepts/transaction_model.mdx#L5-L73
[doc-ops]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/concepts/operations_changes.mdx#L5-L70
[doc-event]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/tutorial/event.mdx#L12-L22
[doc-event-aside]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/tutorial/event.mdx#L84-L89
[doc-attached]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/concepts/attached_detached.mdx#L53-L91
[doc-oplog]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/concepts/oplog_docstate.mdx
[doc-text-delta]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/tutorial/text.mdx#L399-L414
[doc-tips-diff]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/tutorial/tips.mdx#L100-L125
[doc-api-revert]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/docs/api/js.mdx#L1388-L1432
[blog-mirror]: https://github.com/loro-dev/loro-docs/blob/fed85892aa01718072a862d29c48077d427a4e02/pages/blog/loro-mirror.mdx#L23-L58
[txn-on-commit]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/txn.rs#L61-L95
[txn-struct]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/txn.rs#L154-L193
[txn-commit]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/txn.rs#L478-L606
[txn-apply-local-op]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/txn.rs#L697-L813
[txn-change-to-diff]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/txn.rs#L920-L945
[state-apply-local-op]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/state.rs#L1034-L1058
[state-commit-txn]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/state.rs#L1203-L1211
[change-merge]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/change.rs#L268-L282
[change-store-merge]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/oplog/change_store.rs#L1344-L1408
[loro-implicit-commit]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L303-L487
[loro-barriers]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L203-L215
[m-index]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/index.ts#L6-L27
[loro-merge-interval]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L557-L565
[loro-import-json]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L1105-L1120
[loro-revert-diff-apply]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L1701-L1850
[loro-apply-diff-inner]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/loro.rs#L2044-L2215
[h-maybe]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L300-L361
[h-map-attach]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L708-L745
[h-map-container-diff]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L1227-L1251
[h-apply-diff]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L1352-L1555
[h-text-update]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L2780-L2807
[h-list-apply-delta]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L3613-L3666
[h-map-insert-noskip]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L4446-L4476
[h-map-insert]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L4478-L4500
[h-map-insert-container]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L4502-L4545
[h-map-delete]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L4547-L4572
[h-with-txn]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler.rs#L4954-L4970
[h-movable-apply-delta]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-internal/src/handler/movable_list_apply_delta.rs#L1-L90
[w-new]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L654-L661
[w-commit]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L1184-L1221
[w-pending]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L1222-L1230
[w-import-json]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L1837-L1846
[w-revert]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L2385-L2405
[w-apply-diff]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L2407-L2492
[w-diff]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L2494-L2523
[w-pending-queue]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L2682-L2720
[w-text-update]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L2919-L2965
[w-apply-diff-options]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L6741-L6759
[w-diff-types]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/src/lib.rs#L7256-L7316
[w-decorate]: https://github.com/loro-dev/loro/blob/6114e10e631631f6faf060fbda4d9676a42240d1/crates/loro-wasm/index.ts#L424-L527
[m-readme-schema]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/README.md#L90-L176
[m-readme-lists]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/README.md#L252-L272
[m-readme-cid]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/README.md#L274-L302
[m-readme-api]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/README.md#L430-L470
[m-readme-ephemeral]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/README.md#L516-L551
[m-change-types]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L243-L334
[m-subscribe]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L529
[m-handle-event]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L847-L911
[m-update-loro]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L1211-L1233
[m-apply-changes]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L1238-L1306
[m-apply-container]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L1359-L1620
[m-apply-text]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L1555-L1568
[m-insert-map]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L2077-L2129
[m-insert-mergeable]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L2131-L2162
[m-init-container]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L2168-L2318
[m-apply-local]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L2583-L2623
[m-setstate]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/mirror.ts#L2726-L2856
[m-diff-container]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L112-L259
[m-diff-text]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L269-L288
[m-diff-movable]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L495-L688
[m-diff-list-id]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L701-L836
[m-diff-list]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L853-L964
[m-diff-map]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/diff.ts#L1232-L1454
[m-event-apply]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/loroEventApply.ts#L40-L93
[m-immer]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/immer-instance.ts#L1-L30
[m-infer]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/container-inference.ts#L13-L40
[m-utils-equal]: https://github.com/loro-dev/loro-mirror/blob/97fd2f0f79aa797e16829435b08727cd6212787b/packages/core/src/core/utils.ts#L164-L196
[pm-update]: https://github.com/loro-dev/loro-prosemirror/blob/0e036a9bedb432ea7ae238c82d379e1a2fca11d6/src/lib.ts#L71-L95
[pm-text]: https://github.com/loro-dev/loro-prosemirror/blob/0e036a9bedb432ea7ae238c82d379e1a2fca11d6/src/lib.ts#L207-L240
[pm-children]: https://github.com/loro-dev/loro-prosemirror/blob/0e036a9bedb432ea7ae238c82d379e1a2fca11d6/src/lib.ts#L613-L640
[pm-filter]: https://github.com/loro-dev/loro-prosemirror/blob/0e036a9bedb432ea7ae238c82d379e1a2fca11d6/src/sync-plugin.ts#L176-L184
