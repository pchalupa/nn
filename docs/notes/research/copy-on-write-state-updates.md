# Copy-on-write state updates

Researched 2026-10-29 against **Mutative 2.0.1** (tag `v2.0.1`, commit `7ef4bb8`), **Valtio 2.3.2** (tag `v2.3.2`, commit `15c64d4`), **limu 4.1.3** (the `src/` directory shipped in the npm tarball, see the note below) and **structura.js 0.12.9** (npm package `structurajs`, tag `v.0.12.9`, commit `0c1af36`). **Immer 11.2.9** (commit `75a290e`) is the baseline. `@nn/store` was read from the working tree of branch `feat/view` at `94f1578`, uncommitted changes included.

Each library was cloned at the pinned commit and read from source. Official docs are cited where they state intent or guarantees. Every performance number below is the vendor's own and was not reproduced here.

limu's npm `gitHead` (`23a510e`) points to a commit whose `src/` reports version 4.1.0 and differs from the `src/` shipped in the 4.1.3 tarball. The 4.1.3 source is not in the public repository, so limu is cited from `unpkg.com/limu@4.1.3/src/…`. unpkg serves raw files, so line numbers for limu are given in the text.

Immer is covered in depth in [`immer-copy-on-write.md`](./immer-copy-on-write.md). That file was not in the working tree when this note was written. This note only restates what is needed for comparison.

---

## Short answer

- Every proxy-based library here makes four choices: **when a node is copied** (first write, or first read of a child), **how a change reaches ancestors** (flag the chain at write time and assemble at finalize, or copy the chain at write time), **how unchanged subtrees stay shared** (any node that was never copied is referenced as is), and **what the change record is** (a "modified" flag, a version number, a path list or JSON-Patch-like patches).
- **Mutative** works like Immer: a parent is shallow-copied the first time a draftable child is read through it, `markChanged` flags the ancestor chain on write, and finalize writes each child's copy (or its original) back into its parent. It differs from Immer in that it does not freeze by default, takes options per call (`mark`, `strict`, `enablePatches`), runs `shift`/`unshift`/`splice`/`reverse` natively on the copy, and emits `length` replace patches for shorter arrays. Its large speedups over Immer are its own measurements from one machine.
- **Valtio** is not a draft library. State is a long-lived mutable proxy. Writes bump a global version counter, and `snapshot()` rebuilds only the nodes whose version changed, reusing cached snapshots for the rest. Copying happens when a snapshot is read, not when a write happens.
- **limu** shallow-copies on **read** (the proxy target *is* the copy) and only flags on write. Finalize chooses `copy` or `self` for each node it visited.
- **structura.js** copies on **write** and walks the parent links right away, copying every ancestor and linking the child copy in, so there is no finalize pass. It builds patches during that walk.
- **`@nn/store` today** `structuredClone`s the whole projection on every `update`, then makes about four more full passes (identity transfer, `normalize`, `prepare`, `reconcile`) to find changes **by value equality at the leaves**. It never records which paths were written. Its output shares structure only per top-level field: inside a changed field, every node is rebuilt. That was confirmed with a probe.
- A draft-based CoW would cut the write cost to O(touched paths). The cheapest fit is probably to **keep `prepare`/`reconcile` and prune any subtree whose next value `===` the previous projection node**, because array patches are positional and do not map onto `RGA` row keys. The constraints are row identity by object identity, `LWWRegister` timestamps (writes must be value-gated), the prepare-then-apply split that makes updates atomic, and two existing tests that depend on the clone (detached drafts and `defineProperty` on a draft).

---

## 1. The four decisions

| Decision                   | Options seen in the ecosystem                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When a node is copied      | First write to it (structura), first read of a draftable child through it (Immer, Mutative), first read of it (limu), never on write but per changed node at snapshot time (Valtio) |
| How ancestors learn        | A `modified`/`operated` flag set up the parent chain on first write (Immer, Mutative, limu); eager copying of every parent during the write (structura); version polling or listener push (Valtio) |
| How the next tree is built | Finalize pass from the recorded drafts (Immer, Mutative, limu); already built during writes (structura); built lazily per version (Valtio)                                            |
| Change record              | A boolean per node; `assignedMap` per node; patches; op tuples with paths; version numbers                                                                                            |

The sections below answer the same questions for each library: allocation, propagation, sharing, arrays, freezing and patches.

---

## 2. Baseline: Immer 11.2.9

These are the only Immer facts this note relies on:

- **Copy on child read.** When a draftable value is read from a draft and is still the base value at that key, the get trap calls `prepareCopy(state)` to shallow-copy the *parent*. It then creates the child proxy and stores it in `state.copy_[key]` ([`src/core/proxy.ts` L150–L160](https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/core/proxy.ts#L150-L160), [`prepareCopy` L356–L366](https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/core/proxy.ts#L356-L366)).
- **Freezing is on by default** (`autoFreeze_: boolean = true`, [`src/core/immerClass.ts` L48](https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/core/immerClass.ts#L48)).
- Immer 11.0.0 adopted Mutative's finalization callbacks in place of a recursive tree walk ([immerjs/immer#1183](https://github.com/immerjs/immer/pull/1183), as stated in Mutative's [comparison page](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/website/content/docs/extra-topics/comparison-with-immer.mdx)).

See [`immer-copy-on-write.md`](./immer-copy-on-write.md) for the rest.

---

## 3. Mutative 2.0.1: shallow copy on write, Immer's model with different defaults

Source root: <https://github.com/unadlib/mutative/tree/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src>.

### Draft state

`createDraft` allocates one plain state record per drafted object. The record holds `original`, `copy: null`, `parent`, `key`, `operated: false`, `assignedMap`, `finalities` (shared per producer), plus child caches and `arrayState`. It wraps the record in `Proxy.revocable`. Arrays use a one-element array as the proxy target, so `Array.isArray(draft)` holds. Every revoke function and every draft record is pushed onto the producer's `finalities` ([`src/draft.ts` L358–L407](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L358-L407)).

### Allocation: when copies are made

- **Reading a primitive** returns it with no allocation.
- **Reading a draftable child** that is still the original value at that key (or, after native array moves, an original element) calls `ensureShallowCopy(target)` on the **parent**. It then creates the child draft, stores it in `target.copy[key]`, and caches it as `child`/`children` so later reads skip the proxy round trip ([`src/draft.ts` L142–L202](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L142-L202)). So, as in Immer, a **read** of a nested object already allocates the parent's shallow copy. The child itself is not copied until it is written to.
- **Writing** (`setTrap`) returns early when the value equals the current one (`Object.is` semantics, with `0`/`-0` kept apart). Otherwise it calls `ensureShallowCopy` and `markChanged`, records the key in `assignedMap` (`true` for assigned, removed again if the value equals the original), and writes into the copy ([`src/draft.ts` L205–L286](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L205-L286)).
- The shallow copy is `copyPlainObject` for plain objects, `concat`/spread for arrays, `new Map`/`new Set` (subclass-aware), or whatever a `mark` returns ([`src/utils/copy.ts` L120–L179](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/copy.ts#L120-L179)).
- The README states the invariant: "Mutative copies each object at most once per update, however many changes a recipe makes" ([README](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/README.md)).

### Propagation to ancestors

`markChanged` sets `operated = true` and recurses into `parent` until it reaches a node that is already marked ([`src/utils/mark.ts` L3–L11](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/mark.ts#L3-L11)). The flag is only ever set, never cleared. A recipe that writes a value and then writes the original back still leaves `operated === true`, so the result is a new reference, even though `assignedMap` no longer lists the key and no patch is emitted (see Patches below).

### Finalize and sharing

`finalizeDraft` pops every recorded draft (children are pushed after their parents, so they pop first). For each one, `finalizeNode` writes `operated ? copy : original` into the parent's copy at its key, generates its patches, and runs callbacks registered for drafts that were moved or assigned elsewhere ([`src/draft.ts` L445–L489](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L445-L489), [`src/utils/finalize.ts` L142–L232](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/finalize.ts#L142-L232)). The root result is `operated ? copy : original`. Then every proxy is revoked.

Sharing follows from this: a child that was never drafted is still the original reference inside its parent's shallow copy. A drafted child that was not written to is replaced by its `original`. Only nodes on a written path get new identities. Shared references are **not** unified: "each path to a shared object gets its own independent draft" ([README FAQ](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/README.md)).

### Arrays

- **Index writes** go through `setTrap`. Only array-index keys and `length` are accepted. An assignment that leaves holes calls `resized` ([`src/draft.ts` L213–L283](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L213-L283)).
- **Native methods.** On plain arrays without holes, `shift`, `unshift`, `splice`, `reverse` (and `sort`/`join` on primitive arrays) run directly on the copy. `indexOf`/`lastIndexOf`/`includes` search natively. The draft records a `diffStart`/`diffEnd` range and relocation bookkeeping (`baseRefs`, `delta`) so that moved originals can still be drafted lazily ([`src/array.ts`, `arrayMethods` from L498](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/array.ts#L498)). Methods with callbacks (`map`, `filter`, `find`, `forEach`) still go through the proxy and draft every element they visit. In strict mode, development builds warn once 1,000 or more drafts are left unchanged ([`src/draft.ts` L411–L443](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L411-L443)).
- **Patches are positional.** `generateArrayPatches` visits the assigned indices plus the native-method range and emits a `replace` per differing index. A shorter array gets one `replace` of `length` by default, or `remove` per index with `arrayLengthAssignment: false` ([`src/patch.ts` L122–L274](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/patch.ts#L122)). The README says that with patches "both libraries emit one patch per moved index". A `shift()` on N rows therefore yields about N patches.

### Freezing

`enableAutoFreeze` defaults to `false` ([`src/makeCreator.ts` L288–L289](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/makeCreator.ts#L288-L289)). When it is on, `deepFreeze` runs on the whole result but stops at any node that is already frozen ([`src/utils/deepFreeze.ts` L56–L62](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/deepFreeze.ts#L56-L62)). With a frozen base, only the new copies are walked. The comparison page notes that both libraries freeze "the whole result deeply, unchanged parts included" when freezing is on, and that Mutative also freezes Map keys ([comparison-with-immer.mdx](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/website/content/docs/extra-topics/comparison-with-immer.mdx)).

### Patches for objects

`generatePatchesFromAssigned` iterates `assignedMap`. It emits `add`/`replace`/`remove` with values from the copy and skips a `replace` whose value equals the original ([`src/patch.ts` L276–L305](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/patch.ts#L276-L305)). Paths are built by walking `parent` links. A child that left its key (moved, replaced) gets no patches of its own, and the parent's patches carry its value ([`src/utils/draft.ts` `getPath` L92–L133](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/draft.ts#L92-L133)). Since v2, patch values are the objects of the next state, not deep copies ([README, "Migration from Mutative v1 to v2"](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/README.md)).

### `mark` and `strict`

- `mark(value, { mutable, immutable })` decides per read value. `'immutable'` makes a class instance draftable. `'mutable'` hands the raw value to the recipe, which mutates it in place. A function supplies a custom shallow copy, which cannot be combined with patches or auto-freeze ([`src/draft.ts` L78–L93](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/draft.ts#L78-L93), [`shallowCopy` L149–L165](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/src/utils/copy.ts#L149-L165), README `create()` options).
- `strict: true` throws when the recipe reads a value that cannot be drafted (for example a `Date` or an unmarked class instance) outside `unsafe()`. The README recommends enabling it only in development.

### Performance claims (vendor's own)

The README and [`perf-testing/reports/SUMMARY.md`](https://github.com/unadlib/mutative/blob/7ef4bb8274f74502dfb8b013307c70ce1086c4e4/perf-testing/reports/SUMMARY.md) claim the following for Mutative 2.0.0 against Immer 11.1.18:

- 3.6x faster with matched settings and 6.6x faster with each library's defaults (Mutative unfrozen, Immer frozen), as a geometric mean across 97 workloads, and faster in 595 of 614 cases.
- Removing the first of 10,000 rows took 7.04 µs against 7,408 µs.

The method was one Apple M1 Max, Node 24.16.0, one process per library and scenario, and medians of three runs. The summary's own limits say that results in a shared process differed, that wide-object timings vary "by up to about 70 times" with prior V8 state, and that WebKit's `Object.freeze` of a 10,000-element array took about 2.4 ms. The causes the README names are not freezing by default, copying each object at most once, drafting lazily, finalizing only changed drafts, and native array moves. Most of the gap on large arrays comes from the native moves. With patches on, the gain on moves is "bound … to 5–9x", because both libraries emit one patch per moved index.

---

## 4. Valtio 2.3.2: mutable proxy plus versioned, cached snapshots

Source: [`src/vanilla.ts`](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts).

The docs list the design principles: "snapshot is created on demand", "changes are tracked only with version number", "proxies are basically used only for version and subscription" ([how-valtio-works.mdx](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/docs/how-tos/how-valtio-works.mdx)).

- **No copy on write.** `proxy(baseObject)` wraps the object **itself**. Since v2 it no longer clones its input, and the docs tell callers to `deepClone` an object they reuse ([migrating-to-v2.mdx](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/docs/guides/migrating-to-v2.mdx)). Nested objects are wrapped when they are assigned ([L186–L300](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L186-L300)). The set trap returns early on `Object.is` equality. Otherwise it proxies the new value if it can and calls `notifyUpdate` ([L137–L157](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L137-L157)).
- **Propagation is by version.** `notifyUpdate` increments a module-wide `versionHolder[0]` and stores it as this node's version ([L196–L204](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L196-L204)). Ancestors learn in one of two ways:
  - **Push**, while the ancestor has listeners: each child prop is subscribed with a listener that prepends the prop to the op path and re-notifies ([L218–L277](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L218-L277)).
  - **Pull**, without listeners: `ensureVersion` asks each child for its version and takes the maximum ([L206–L217](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L206-L217)).
- **The copy happens at snapshot time, per changed node.** `createSnapshotDefault(target, version)` returns the cached snapshot if `snapCache` holds one for that version. Otherwise it allocates a new object or array, defines each own key as a non-writable data property, and recurses into child proxies with their own versions ([L78–L120](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L78-L120)). Unchanged subtrees come back from the cache by reference. The docs' example shows `snap1.b === snap2.b` after only `a` changed.
- **Arrays** are ordinary proxied arrays. Native methods run through the set and delete traps (each index write and the `length` write notify). A snapshot of a changed array defines every index again.
- **Freezing:** none. Snapshot properties are `writable: false` and `configurable: true`, and `Object.preventExtensions` was removed ([L101–L118](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L101-L118)).
- **Patches:** `subscribe` delivers op tuples `['set', path, value, prev]` / `['delete', path, prev]`, but only after `unstable_enableOp()`. The default `createOp` is `undefined` ([L181](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L181), [L449–L459](https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts#L449-L459)). Paths are positional for arrays.

Valtio is relevant here as a model for the **read side**. It builds a projection lazily from a mutable source and reuses each node's previous snapshot while that node's version has not moved.

---

## 5. limu 4.1.3: shallow copy on read, flag on write

Source: `https://unpkg.com/limu@4.1.3/src/…`. The README describes the mechanism as "shallow copy on read and mark modified on write" and states that it does not freeze by default ([README](https://unpkg.com/limu@4.1.3/README.md)).

- **Allocation on read.** When a child object is read for the first time, `getMayProxiedVal` calls `createScopedMeta` (`core/helper.ts` L52–L87). That function makes `copy = mayMakeCopy(baseData)` (a spread, `slice`, `new Map` or `new Set`; `core/copy.ts` L50–L108) and creates the proxy **with the copy as its target** (`core/helper.ts` L13–L40). It then writes `parent[key] = valMeta.copy`, so the parent's copy already points at the child's copy. Every object that is read is copied, whether or not it is written to.
- **Write:** `markModified` sets `modified` up the `parentMeta` chain until it reaches an already-modified node (`core/meta.ts` L30–L40). Array, Map and Set mutator methods called through the get trap also mark the parent (`core/data-node-processor.ts` L24–L36).
- **Finalize:** `extractFinalData` returns `rootMeta.copy` if the root was modified and `self` otherwise (`core/scope.ts` L222–L234). `clearScopes` then visits every scoped meta and writes `modified ? copy : self` back into the parent copy (`core/scope.ts` L39–L104). This undoes the eager links for subtrees that were read but not changed, so they are shared by reference again.
- **Arrays:** array methods run on the copy (`parentCopy[op]`). Order-changing methods set `isArrOrderChanged` (`core/data-node-processor.ts` L70–L94).
- **Freezing:** `autoFreeze: false` by default (`support/inner-data.ts` L59). `deepFreeze` is applied to the whole result when it is enabled (`core/build-limu-apis.ts`, `finishDraft`).
- **Patches:** there are none. `produceWithPatches` is commented out (`index.ts` L221). There is an `onOperate` callback that receives, for each get, set or delete, `fullKeyPath`, `keyPaths` (several when an object is referenced from more than one place), `isChanged` and the value (`inner-types.ts` `IOperateParams` from L84). That is effectively a stream of touched paths.
- **Performance (vendor's own):** "10 times or more faster than Immer in most scenarios" and "the fastest immutable js lib of all (faster than immer and mutative)", with no freezing and a CodeSandbox demo as evidence (README). No method or environment is documented alongside the claim.

---

## 6. structura.js 0.12.9: copy on write with an eager parent walk

Source: <https://github.com/GiuseppeRaso/structura.js/tree/0c1af36ead5d9285dc260583676c688581319ef9/src>. The README calls the library "in alpha state".

- **One proxy per original object, with all its parents.** `createProxy` looks the original up in a `WeakMap`. On a hit it adds the new `(parent, link)` pair to `itemData.parents` instead of creating a second draft ([`src/proxy/createProxy.ts` L20–L59](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/proxy/createProxy.ts#L20-L59)). Reads allocate a proxy and a parent link, not a copy ([`proxyHandler.ts` L188](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/proxy/proxyHandler.ts#L188)).
- **Write:** `set` compares with the current value and calls `walkParents` ([L190–L200](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/proxy/proxyHandler.ts#L190-L200)). `walkParents` shallow-clones the target on its first modification ([`walkParents.ts` L46–L51](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/internals/walkParents.ts#L46-L51)). It then recurses into **every** parent, with an `append` action that sets the child's shallow copy into the parent's shallow copy at each link ([L180–L268](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/internals/walkParents.ts#L180-L268)). Each link is traversed once per producer. When the recipe ends, the next state is simply `itemData.modified ? itemData.shallow : state` for the root ([`produce.ts` L83](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/core/produce.ts#L83)). There is no finalize walk, and shared references stay shared.
- **Patches** are built during the same walk as a tree of nested `next` patches per link. They are converted to standard patches only if `enableStandardPatches` is set ([L269–L281](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/internals/walkParents.ts#L269-L281), [`produce.ts` L84–L102](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/core/produce.ts#L84-L102)).
- **Freezing:** `autoFreeze: false` ([`src/helpers/settings.ts`](https://github.com/GiuseppeRaso/structura.js/blob/0c1af36ead5d9285dc260583676c688581319ef9/src/helpers/settings.ts)). The README says it "freezes the object only at compile time by leveraging Typescript".
- **Performance (vendor's own):** "up to ~10x more performant" than Immer (README). No method is given there.

---

## 7. Side by side

|                         | Immer 11.2.9                       | Mutative 2.0.1                                  | limu 4.1.3                          | structura 0.12.9                         | Valtio 2.3.2                                 |
| ----------------------- | ---------------------------------- | ----------------------------------------------- | ----------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Copy allocated on       | parent: first child read; leaf: first write | same as Immer                          | first read of the node              | first write                              | snapshot of a changed node                   |
| Ancestors               | flag chain, assemble at finalize   | `markChanged` chain, finalize per draft         | `markModified` chain, `clearScopes` | eager copy and link along every parent   | version bump, push or pull                   |
| Shared refs in input    | one draft per path                 | one draft per path                              | tracked via `keyPaths`              | one proxy per object, many parents       | one proxy per object                         |
| Array moves             | through proxy (opt-in plugin)      | native on copy for `shift`/`unshift`/`splice`/`reverse` | native on copy               | through proxy                            | native on the live array                     |
| Auto-freeze default     | on                                 | off                                             | off                                 | off                                      | none (non-writable props)                    |
| Change record           | patches (plugin)                   | patches built in, positional for arrays         | `onOperate` path stream             | nested patch tree                        | op tuples (unstable, opt-in)                 |
| "Changed" cleared on revert | no                             | no (`operated` sticky; patch skipped)           | no                                  | no                                       | n/a (`Object.is` early-out per write)        |

---

## 8. `@nn/store` today: clone the projection, then diff it

### The pipeline

`State.update(recipe)` (`packages/store/src/State.ts:70`):

1. **`this.read()`** (`State.ts:63`). If a field changed since the last read, each invalidated `View` re-materializes its whole field from entities (`View.ts:27`): `Object.fromEntries` per `LWWMap`, `entity.current.map` per `RGA`, and `identities.remember(row, rga, key)` per row object (`View.ts:36`). The root object is rebuilt with `Object.freeze` (`State.ts:65`).
2. **`identities.clone(projection)`** (`RowIdentity.ts:30`). This is `structuredClone` of the **entire** projection, all fields (`plain.ts:4`). `transfer` then walks the source and the clone in parallel and copies each row's `{owner, key}` into the `WeakMap` for the cloned row (`RowIdentity.ts:38`).
3. **The recipe** mutates the plain clone. There is no proxy and no tracking. A `then`-able result is rejected (`State.ts:74`).
4. **`normalize(schema, draft, identities)`** (`normalize.ts:6`) validates the whole draft against the schema (undeclared field, missing field, type) and **allocates a new tree**, copying row identity onto each new object (`normalize.ts:21`).
5. **`prepare`** (`reconcile.ts:36`) walks the entity tree and the normalized value in parallel and **allocates a third tree**:
   - Registers: `clone(value)`, one `structuredClone` call per leaf (`reconcile.ts:37`).
   - Maps: field by field.
   - Scalar arrays: **by index** against `entity.current[index]` (`reconcile.ts:53`).
   - Row arrays: `prepareRows` resolves each row's key through `identities.keyOf(row, collection)` plus `collection.find`, creates entities for new rows, rejects duplicate keys, and rejects any reordering of surviving rows as `"move"` (`reconcile.ts:71–102`).
6. **`reconcile`** (`reconcile.ts:104`), inside `batch.run`, walks again and writes. A register is written only if `!Object.is(current, next)` (`reconcile.ts:106`). Missing row keys are `remove`d, and new rows are `push`ed.
7. Each `LWWRegister` write emits `change`, which bubbles through `LWWMap`/`RGA` subscriptions to the top-level field. `State`'s field subscription invalidates that field's `View` and the root projection (`State.ts:44–49`). `Batch` coalesces the publish to one per `update`.

Steps 5 and 6 are split so that every validation error is thrown before any entity is touched. The tests rely on this ("rejects unsupported %s ordering atomically" and "rejects %s in a later entry before applying any earlier entry", `State.snapshot.test.ts`).

### Allocation cost

Reading the code, for a state of _n_ plain nodes, one `update` that changes one scalar does:

- one full `structuredClone` (step 2)
- one full identity walk (step 2)
- two more full tree allocations (`normalize`, `prepare`)
- `n_leaves` extra `structuredClone` calls on primitives (`prepare` registers)
- one full `reconcile` walk with an `Array.from` per `RGA` (`RGA.ts:39`)
- on the next `read()`, a full re-materialization of the changed top-level field.

That is roughly five O(_n_) passes, at least three of which allocate O(_n_), whatever the size of the edit. A CoW draft does O(depth) proxy allocations, plus one shallow copy per container on the written path. For an array that copy is O(width), and no CoW library avoids it. This note did not benchmark either approach. `packages/store/src/Store.bench.ts` exists and was not run.

### Change detection

Changes are detected **by value at the leaves**, not by tracking writes: `Object.is` per register, and key-set membership per `RGA`. Every path is visited. This has one property that the CoW libraries above do not: an edit that cancels out (`title = "x"; title = "First"`, or `push` then `pop`) produces no entity write, no timestamp bump, no notification, and **the same `read()` reference** ("keeps timestamps, snapshots and notifications unchanged when edits cancel out", `State.snapshot.test.ts`). In Mutative, `operated` stays set after a revert, so the root is a new object, even though no patch is emitted for an object key that was reverted.

### Structural sharing of the output

A scratch Vitest probe was run against the working tree, with no repo files changed. It used `object({ language, settings: object({ theme }), tickets: array(object({ title, assignee: object({ name }) })) })` with two rows, and changed `tickets[0].title`:

| Check                                                 | Result  |
| ----------------------------------------------------- | ------- |
| `Object.isFrozen(read())`                             | `true`  |
| `Object.isFrozen(read().tickets)` / a row / `settings` | `false` |
| `after === before` (root)                             | `false` |
| `after.settings === before.settings` (untouched field) | `true`  |
| `after.tickets === before.tickets`                    | `false` |
| untouched row `tickets[1]` shared                     | `false` |
| untouched nested `tickets[0].assignee` shared         | `false` |

Sharing is therefore **per top-level field only**, and only the root object is frozen. `View.materialize` never calls `freeze`, although the test title in `View.test.ts:22` says "deeply frozen". The reason for the coarse sharing is that `Entity.emit("change")` carries no payload (`Entity.ts:29`), and `View` caches one projection per field and drops it on any change (`View.ts:23`).

---

## 9. What a draft-based CoW in `@nn/store` would have to do

### What `reconcile` consumes today

`reconcile(entity, value, schema)` takes a full prepared tree: plain values for registers, field records for maps, and `Item { key, value, created? }` lists for `RGA`s. Every row is resolved to a key before anything is applied. Anything a CoW draft emits must be turned into either that shape or a narrower equivalent before step 6, so that the atomicity split survives.

### Options

These are options, not decisions.

**A. CoW draft, keep the diff, prune by identity.** Draft over the frozen `read()` projection with a CoW proxy (written in-house, or Mutative with `enableAutoFreeze` off). The finalized tree shares every untouched node by reference with the previous projection. `normalize`/`prepare`/`reconcile` already walk entity and value in parallel. Passing the previous projection node alongside would let them return "unchanged" whenever `next === previous`, so the cost becomes O(touched paths plus the widths of touched containers). Value-level leaf comparison stays, so the cancel-out guarantee is kept for free. This is the smallest change to the current architecture, and it is the Immer/Mutative model with the store's existing diff acting as the "finalize" step.

**B. Emit touched paths.** The draft records the paths of writes, in the way limu's `onOperate` `fullKeyPath`, Valtio's op paths and structura's parent links do. `reconcile` then visits only those paths and their ancestors. Index paths into row arrays go stale as soon as the recipe inserts or removes rows, so they would have to be resolved to row keys at finalize. That needs the same identity lookup `prepareRows` does today.

**C. Emit patches (Mutative `enablePatches`).** Object and register paths map cleanly: `replace /field/sub` becomes a register write. Array patches are positional (`replace` per index, `length` replace), and a `shift()` emits one per moved index. `RGA` wants key-level `push`/`remove`, so translating positional patches back means re-diffing the array by identity, which is option A's work anyway. `add`/`replace` values for new subtrees still need `createEntity`. Scalar arrays are the exception: `prepare` already treats them positionally (`reconcile.ts:53`), so index patches map onto them directly.

**D. Read side only: version-cached `View` projections (Valtio's model).** This is independent of A–C. `Entity.revision` already increments on every `emit` (`Entity.ts:24–33`), and `LWWMap`/`RGA` re-emit when a child emits (`LWWMap.ts:15–20`, `RGA.ts:26–32`). So a changed leaf bumps its ancestors' revisions and leaves its siblings' revisions alone. Caching each entity's materialized node by `(entity, revision)`, as Valtio's `snapCache` keys snapshots by version, would give per-node sharing in `read()`. It would also give option A the reference-equal previous nodes it needs.

### Constraints imposed by the entities and `RowIdentity`

- **Row identity is object identity.** `RowIdentity` is a `WeakMap<object, {owner, key}>` populated by `View` (`RowIdentity.ts:12`, `View.ts:36`). With CoW, a row that was written to becomes a new copy object. The mapping must follow it through the draft's back-pointer to the base (Mutative's `proxyDraft.original` / `original()`, limu's `meta.self`, structura's `itemData.original`). A fresh object assigned into the draft must stay unidentified, so it gets a new key ("gives an equal-valued fresh replacement a new identity"). CoW libraries do not draft assigned values, which matches. The duplicate-row check ("rejects the same identified row twice…") still works if both occurrences resolve to the same original.
- **No moves.** `RGA` is a stub (`RGA.ts:5`, "Implementation of RGA isn't done yet") with no move operation, and `prepareRows` throws `unsupported("move")` for any reordering of surviving rows. Mutative's native `reverse`/`unshift`/`splice` would produce states that the store then rejects, which is the same outcome as today, only reached faster.
- **Writes must be gated on value.** `LWWRegister.current = v` always bumps `timestamp` and emits (`LWWRegister.ts:18–22`), and register timestamps are persisted and merged. Provenance flags (`operated`, `modified`) are sticky, so they cannot replace the `Object.is` check in `reconcile`.
- **Atomicity.** All checks (schema, duplicates, moves) must run before the first entity write. Option B or C must plan everything before applying anything, as `prepare` does now.
- **Validation scope.** `normalize` validates the whole draft and allows invalid intermediate states ("validates only the final result"). With CoW, only copied objects (their key set and changed leaves) and assigned subtrees need checking. Assigned subtrees are already normalized again in `createEntity` (`entities.ts:50`).
- **The base must be immutable.** Today the draft is a deep clone, so a caller who mutates a non-frozen `read()` node corrupts only the cached projection. A CoW draft reads **through** to the projection, and a mutated projection node would be written back on the next `update`. Under CoW, deep-freezing the projection (or an equivalent guarantee) becomes a correctness requirement. With per-node sharing, freezing only new nodes is cheap, as Mutative's freeze walk that stops at frozen nodes shows.
- **Draft lifetime and traps.** Two current tests depend on the plain clone:
  - "detaches retained drafts and inserted caller-owned values" writes to a draft reference **after** the recipe and expects it to be silently ignored. Revocable proxies (Mutative revokes all of them in `finalizeDraft`) would throw a `TypeError` there instead.
  - "preserves existing row identity while normalizing a computed field once" calls `Object.defineProperty` on a draft row. Mutative's `defineProperty` trap throws (`src/draft.ts` L319–L321).

  Either the tests change, or the draft keeps these behaviours.
- **Caller-owned inserted values** are already detached: `createEntity` clones register values (`entities.ts:46`). That stays true under any CoW, as long as new rows still go through `createEntity`.

---

## Not verified

- No benchmarks were run. All performance figures are the vendors' own: Mutative's from a single-machine Node.js run with a documented method, and limu's and structura's without a documented method.
- limu 4.1.3 source exists only in the npm tarball. The public repo's latest commit (`23a510e`) is 4.1.0 and differs, for example in `fast` mode and the multi-reference handling.
- The Valtio op API is explicitly `unstable_`.
- `immer-copy-on-write.md` was referenced as existing but was not present in `docs/notes/research/` when this note was written.
- The store probe covered one schema and one edit. The pass counts in §8 come from reading the code, not from profiling.

## Source list

- Mutative 2.0.1: <https://github.com/unadlib/mutative/tree/7ef4bb8274f74502dfb8b013307c70ce1086c4e4>. Key files: `src/draft.ts`, `src/utils/{mark,copy,finalize,deepFreeze,draft}.ts`, `src/array.ts`, `src/patch.ts`, `src/makeCreator.ts`, `README.md`, `perf-testing/reports/SUMMARY.md`, `website/content/docs/extra-topics/comparison-with-immer.mdx`. npm: `mutative@2.0.1`, `gitHead` `7ef4bb8`.
- Valtio 2.3.2: <https://github.com/pmndrs/valtio/blob/15c64d4d7a7a9bd55d750fa6a317b440978a2b25/src/vanilla.ts>, `docs/how-tos/how-valtio-works.mdx`, `docs/guides/migrating-to-v2.mdx`. npm: `valtio@2.3.2`, `gitHead` `15c64d4`.
- limu 4.1.3: <https://unpkg.com/limu@4.1.3/src/> (`core/{build-limu-apis,helper,copy,meta,scope,data-node-processor}.ts`, `support/inner-data.ts`, `inner-types.ts`, `index.ts`), <https://unpkg.com/limu@4.1.3/README.md>.
- structura.js 0.12.9: <https://github.com/GiuseppeRaso/structura.js/tree/0c1af36ead5d9285dc260583676c688581319ef9> (`src/proxy/{createProxy,proxyHandler}.ts`, `src/internals/walkParents.ts`, `src/core/produce.ts`, `src/helpers/settings.ts`). npm: `structurajs@0.12.9`, `gitHead` `0c1af36`.
- Immer 11.2.9: <https://github.com/immerjs/immer/blob/75a290e44ba14bd723c8ef8546b6559c8ef3ae88/src/core/proxy.ts>, `src/core/immerClass.ts`. npm: `immer@11.2.9`, `gitHead` `75a290e`.
- `@nn/store` (working tree, `feat/view` at `94f1578` plus uncommitted changes): `packages/store/src/{State,RowIdentity,plain,normalize,reconcile,View,entities,Batch}.ts`, `State.snapshot.test.ts`, `View.test.ts`; `packages/entities/src/{Entity,LWWMap,LWWRegister,RGA}.ts`.
