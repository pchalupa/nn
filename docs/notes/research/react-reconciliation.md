# React reconciliation: what changed, and which DOM mutations to apply

Research date: **2026-09-30**. Source of every mechanism claim below is the React repo at tag **`v19.3.0`**, commit `1d34f91dfde6bba84d08b683aaba164c7194dacb`, read from a sparse clone. Contrasts with the older model are read from tag **`v18.3.1`**, commit `f1338f8080abd1386454a10bbf93d67bfe37ce85`. This repo pins `react` and `react-dom` to **19.3.0** in the `pnpm-workspace.yaml` catalog, and `node_modules/.pnpm` has `react@19.3.0` installed, so the tag matches what `@nn/react` builds against.

Docs are cited only where they state intent, guarantees, or heuristics. Where a doc page simplifies or lags the implementation, that is flagged explicitly.

## Short answer

React does not read the DOM to work out what changed. It compares the element tree a render just returned against the previous **fiber tree**, which is React's own in-memory copy of the last committed UI. The real DOM is a write target. [`ReactChildFiber.js`][cf] [`ReactFiber.js`][fiber]

The comparison is cheap because it is mostly reference equality. A fiber is reused when the new element has the same `type` and the same `key` as the fiber in that slot; otherwise the old fiber is deleted and a new one is created. [`updateElement`][cf] Props are compared by object identity during render (`oldProps === newProps`), and only in the commit phase does React walk individual prop keys to decide which attributes to touch. [`ReactFiberCompleteWork.js`][cw] [`ReactDOMComponent.js`][rdc]

Version boundary that matters: React 18 computed a per-element `updatePayload` array during render (`prepareUpdate` → `diffProperties`) and applied it at commit. React 19 removed that. Today `completeWork` only sets an `Update` flag, and `commitUpdate` compares `oldProps` against `newProps` at commit time. The change shipped in commit `7f6201889` ("Ship diffInCommitPhase", [PR #27409][pr27409], 2023-09-22). Descriptions of an "update payload" are describing React 18 or earlier.

The real performance story is not the diff. It is the **bailout**: if a fiber's props are reference-equal to last time and no update is scheduled in its subtree, React returns `null` from `beginWork` and never enters the subtree at all. [`ReactFiberBeginWork.js`][bw]

---

## 1. Two trees, no DOM reads

### Double buffering: `current`, `workInProgress`, `alternate`

Every fiber can have at most two versions, linked to each other by `alternate`. One is committed (`current`), the other is the one being built (`workInProgress`). `createWorkInProgress` allocates the second one lazily and from then on reuses it, in place, for every render:

`packages/react-reconciler/src/ReactFiber.js`:

```js
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate;
  if (workInProgress === null) {
    // We use a double buffering pooling technique because we know that we'll
    // only ever need at most two versions of a tree. We pool the "other" unused
    // node that we're free to reuse. This is lazily created to avoid allocating
    // extra objects for things that are never updated. It also allow us to
    // reclaim the extra memory if needed.
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode,
    );
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;
    ...
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;

    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.flags = NoFlags;

    // The effects are no longer valid.
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
    ...
  }

  // Reset all effects except static ones.
  // Static effects are not specific to a render.
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;
  ...
}
```

Two things to notice. `stateNode` (the actual DOM node) is carried over, not re-read. And `memoizedProps` on `current` is the props React rendered with last time. That field, not the DOM, is the "before" side of every comparison.

The swap happens once per commit, between the mutation and layout phases:

`packages/react-reconciler/src/ReactFiberWorkLoop.js`, in `flushMutationEffects`:

```js
// The work-in-progress tree is now the current tree. This must come after
// the mutation phase, so that the previous tree is still current during
// componentWillUnmount, but before the layout phase, so that the finished
// work is current during componentDidMount/Update.
root.current = finishedWork;
```

### What the DOM is used for

Written to, from the host config: `createInstance`/`setInitialProperties` on mount, `commitUpdate` → `updateProperties` on update, `appendChild`/`insertBefore` for placements, `removeChild` for deletions, `textInstance.nodeValue = newText` for text. [`ReactFiberConfigDOM.js`][cfg]

Never used as the "previous value" for diffing. Even the question "where do I insert this node?" is answered from the fiber tree, not from the DOM. `getHostSibling` walks fibers:

`packages/react-reconciler/src/ReactFiberCommitHostEffects.js`:

```js
function getHostSibling(fiber: Fiber): ?Instance {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node: Fiber = fiber;
  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    ...
```

There are four places where React genuinely reads the live DOM, and none of them are the diff. They are in section 7.

---

## 2. The version boundary: `updatePayload` is gone

This is the part most explanations get wrong, so it is worth pinning both sides.

### React 18.3.1: diff during render, apply at commit

`packages/react-reconciler/src/ReactFiberCompleteWork.new.js` (v18.3.1):

```js
  updateHostComponent = function(
    current: Fiber,
    workInProgress: Fiber,
    type: Type,
    newProps: Props,
    rootContainerInstance: Container,
  ) {
    const oldProps = current.memoizedProps;
    if (oldProps === newProps) {
      // In mutation mode, this is sufficient for a bailout because
      // we won't touch this node even if children changed.
      return;
    }
    const instance: Instance = workInProgress.stateNode;
    const currentHostContext = getHostContext();
    const updatePayload = prepareUpdate(
      instance,
      type,
      oldProps,
      newProps,
      rootContainerInstance,
      currentHostContext,
    );
    // TODO: Type this specific to this type of component.
    workInProgress.updateQueue = (updatePayload: any);
    // If the update payload indicates that there is a change or if there
    // is a new ref we mark this as an update. All the work is done in commitWork.
    if (updatePayload) {
      markUpdate(workInProgress);
    }
  };
```

`prepareUpdate` delegated to `diffProperties`, which built a flat `[key1, value1, key2, value2, ...]` array (`packages/react-dom/src/client/ReactDOMComponent.js`, v18.3.1):

```js
    } else {
      // For any other property we always add it to the queue and then we
      // filter it out using the allowed property list during the commit.
      (updatePayload = updatePayload || []).push(propKey, nextProp);
    }
  }
  if (styleUpdates) {
    ...
    (updatePayload = updatePayload || []).push(STYLE, styleUpdates);
  }
  return updatePayload;
}
```

and `commitUpdate` took that array as an argument:

```js
export function commitUpdate(
  domElement: Instance,
  updatePayload: Array<mixed>,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object,
): void {
  // Apply the diff to the DOM node.
  updateProperties(domElement, updatePayload, type, oldProps, newProps);
  updateFiberProps(domElement, newProps);
}
```

### React 19.3.0: no payload, compare at commit

`prepareUpdate` no longer exists anywhere in the repo (`grep -rn "prepareUpdate" packages/` returns nothing at `v19.3.0`). The render phase now does a single reference check:

`packages/react-reconciler/src/ReactFiberCompleteWork.js`:

```js
function updateHostComponent(
  current: Fiber,
  workInProgress: Fiber,
  type: Type,
  newProps: Props,
  renderLanes: Lanes,
) {
  if (supportsMutation) {
    // If we have an alternate, that means this is an update and we need to
    // schedule a side-effect to do the updates.
    const oldProps = current.memoizedProps;
    if (oldProps === newProps) {
      // In mutation mode, this is sufficient for a bailout because
      // we won't touch this node even if children changed.
      return;
    }

    markUpdate(workInProgress);
  } else if (supportsPersistence) {
    ...
```

`markUpdate` is one line: `workInProgress.flags |= Update;`.

So after render, `Update` means "props objects are not identical, look closer later". The real per-key comparison happens in the commit phase:

`packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js`:

```js
export function commitUpdate(
  domElement: Instance,
  type: string,
  oldProps: Props,
  newProps: Props,
  internalInstanceHandle: Object,
): void {
  // Diff and update the properties.
  updateProperties(domElement, type, oldProps, newProps);

  // Update the props handle so that we know which props are the ones with
  // with current event handlers.
  updateFiberProps(domElement, newProps);
}
```

`packages/react-dom-bindings/src/client/ReactDOMComponent.js`, the generic tail of `updateProperties` (there are earlier specialised branches for `input`, `select`, `textarea`, `option`, `form`, and so on, plus a fast path that skips straight to here for `div`, `span`, `svg`, `path`, `a`, `g`, `p`, `li`):

```js
  for (const propKey in lastProps) {
    const lastProp = lastProps[propKey];
    if (
      lastProps.hasOwnProperty(propKey) &&
      lastProp != null &&
      !nextProps.hasOwnProperty(propKey)
    ) {
      setProp(domElement, tag, propKey, null, nextProps, lastProp);
    }
  }
  for (const propKey in nextProps) {
    const nextProp = nextProps[propKey];
    const lastProp = lastProps[propKey];
    if (
      nextProps.hasOwnProperty(propKey) &&
      nextProp !== lastProp &&
      (nextProp != null || lastProp != null)
    ) {
      setProp(domElement, tag, propKey, nextProp, nextProps, lastProp);
    }
  }
}
```

Two passes, both over plain objects: remove props that disappeared, then set props whose value changed by `!==`. No DOM reads, no intermediate array.

The old props are handed to `commitUpdate` from the `current` fiber, in `ReactFiberCommitWork.js`:

```js
        if (flags & Update) {
          const instance: Instance = finishedWork.stateNode;
          if (instance != null) {
            // Commit the work prepared earlier.
            // For hydration we reuse the update path but we treat the oldProps
            // as the newProps. The updatePayload will contain the real change in
            // this case.
            const newProps = finishedWork.memoizedProps;
            const oldProps =
              current !== null ? current.memoizedProps : newProps;
            commitHostUpdate(finishedWork, newProps, oldProps);
          }
        }
```

The comment mentioning "the updatePayload" is stale, left over from the 18.x model. There is no payload any more.

**Where the docs lag.** The legacy Reconciliation page says React "looks at the attributes of both, keeps the same underlying DOM node, and only updates the changed attributes" ([legacy.reactjs.org][doc-recon]). That is still an accurate description of the outcome. It just does not say when the attribute comparison happens, and since React 19 it happens at commit, not at render.

**Cost consequence.** In 18, an element whose props object changed identity but whose values were all equal produced `updatePayload === null` and no `Update` flag, so the commit skipped it. In 19 that element gets `Update` and `updateProperties` runs, finds every `nextProp === lastProp`, and writes nothing. The work moved, it did not disappear. Meta reported the change as performance-neutral in the shipping commit message ("Performance tests at Meta showed neutral results", commit `7f6201889`).

---

## 3. The two documented heuristics, and the code behind them

The legacy Reconciliation doc states React uses "a heuristic O(n) algorithm based on two assumptions": that "two elements of different types will produce different trees", and that the developer can mark stable children with `key` [[legacy doc][doc-recon]].

### Heuristic 1: different `type` → tear down and rebuild

Implemented in `updateElement`, `packages/react-reconciler/src/ReactChildFiber.js`:

```js
    if (current !== null) {
      if (
        current.elementType === elementType ||
        // Keep this check inline so it only runs on the false path:
        (__DEV__
          ? isCompatibleFamilyForHotReloading(current, element)
          : false) ||
        // Lazy types should reconcile their resolved type.
        ...
      ) {
        // Move based on index
        const existing = useFiber(current, element.props);
        coerceRef(existing, element);
        existing.return = returnFiber;
        ...
        return existing;
      }
    }
    // Insert
    const created = createFiberFromElement(element, returnFiber.mode, lanes);
```

`current.elementType === elementType` is a single reference comparison. If it fails, the old fiber is not reused; a brand new one is created, and the old one is deleted by the caller. Because the old fiber's whole subtree goes with it, the subtree is rebuilt — that is the "tear down the old tree and build the new tree from scratch" the doc describes.

This is also the mechanism behind the react.dev rule that "when you render a different component in the same position, it resets the state of its entire subtree" [[react.dev][doc-state]]. State lives on the fiber (`memoizedState`), so discarding the fiber discards the state.

Note what `elementType` is: for `<div/>` it is the string `"div"`; for `<Foo/>` it is the function `Foo`. So declaring a component inside another component's body creates a new function identity every render, fails this check, and remounts the subtree every time. The source explains why the check is a bare `===` and nothing cleverer.

### Heuristic 2: same type → update in place

Same code path, the `useFiber(current, element.props)` branch. `useFiber` is a thin wrapper over `createWorkInProgress`:

```js
  function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {
    // We currently set sibling to null and index to 0 here because it is easy
    // to forget to do before returning it. E.g. for the single child case.
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }
```

The `stateNode` — the DOM node — rides along untouched. That is what "keeps the same underlying DOM node" means concretely.

### Heuristic 3: `key` identifies children across reorders

`key` is stored on the fiber and compared before `type`. In `updateSlot`:

```js
    // Update the fiber if the keys match, otherwise return null.
    const key = oldFiber !== null ? oldFiber.key : null;
    ...
        case REACT_ELEMENT_TYPE: {
          if (
            newChild.key === key
          ) {
            ...
            const updated = updateElement(returnFiber, oldFiber, newChild, lanes);
            ...
            return updated;
          } else {
            return null;
          }
        }
```

Returning `null` from `updateSlot` is what aborts the fast path and sends the whole remaining list to the keyed map pass (section 4). And in the single-child case, `reconcileSingleElement` scans siblings for a key match and deletes everything that does not match:

```js
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      if (
        child.key === key ||
        (enableOptimisticKey && child.key === REACT_OPTIMISTIC_KEY)
      ) {
        ...
          if (
            child.elementType === elementType ||
            ...
          ) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = useFiber(child, element.props);
            ...
            return existing;
          }
        // Didn't match.
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }
```

`mapRemainingChildren` shows what "unkeyed" actually means: the index is used as the key.

```js
    let existingChild: null | Fiber = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key === null) {
        existingChildren.set(existingChild.index, existingChild);
      } else if (...) {
        ...
      } else {
        existingChildren.set(existingChild.key, existingChild);
      }
      existingChild = existingChild.sibling;
    }
```

So the docs' "keys only have to be unique among siblings" is literal: the map is per parent, built fresh each time.

---

## 4. Child list reconciliation in detail

`reconcileChildrenArray` in `packages/react-reconciler/src/ReactChildFiber.js`. It runs in up to three passes.

The file is candid about the design:

```js
    // This algorithm can't optimize by searching from both ends since we
    // don't have backpointers on fibers. I'm trying to see how far we can get
    // with that model. If it ends up not being worth the tradeoffs, we can
    // add it later.
    ...
    // In this first iteration, we'll just live with hitting the bad case
    // (adding everything to a Map) in for every insert/move.
```

There is no longest-increasing-subsequence step and no two-ended scan, unlike Vue's `patchKeyedChildren`. That has an observable cost, shown in the rotate example below.

### Pass 1: shared prefix, slot by slot

```js
    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        lanes,
      );
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }

      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      ...
    }
```

The bail conditions are all `updateSlot` returning `null`:

- element key differs from the old fiber's key;
- the new child is a string/number and the old fiber has a non-null key;
- the new child is an array or iterable and the old fiber has a non-null key;
- a `null`, `undefined`, or boolean child (`createChild` returns `null` for those). The TODO above says this is a known wart: a conditional child rendered as `{cond && <X/>}` drops the whole list onto the slow path.

Note that `newFiber.alternate === null` after a successful `updateSlot` means the slot matched by key but the `type` differed, so a fresh fiber was created. The old one is deleted right there.

### Early exits

```js
    if (newIdx === newChildren.length) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      ...
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
        ...
      }
      ...
      return resultingFirstChild;
    }
```

Pure truncation and pure append never build a map.

### Pass 2: the keyed map

```js
    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(oldFiber);

    // Keep scanning and use the map to restore deleted items as moves.
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes,
      );
      if (newFiber !== null) {
        ...
        if (shouldTrackSideEffects) {
          const currentFiber = newFiber.alternate;
          if (currentFiber !== null) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            ...
            existingChildren.delete(
              currentFiber.key === null ? newIdx : currentFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        ...
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }
```

Matching is by key, or by index for unkeyed children (`existingChildren.get(newChild.key === null ? newIdx : newChild.key)` in `updateFromMap`). Whatever is left in the map at the end is deleted.

### `placeChild` and `lastPlacedIndex`

This is the whole move-detection algorithm:

```js
  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number,
  ): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      // During hydration, the useId algorithm needs to know which fibers are
      // part of a list of children (arrays, iterators).
      newFiber.flags |= Forked;
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move. The fiber already existed, so this is not a new
        // mount; don't set PlacementDEV, which would cause StrictMode to
        // re-run the effects in its subtree as if it had remounted.
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        // This item can stay in place.
        return oldIndex;
      }
    } else {
      // This is an insertion.
      newFiber.flags |= Placement | PlacementDEV;
      return lastPlacedIndex;
    }
  }
```

In words: walk the new list left to right. `lastPlacedIndex` is the largest old index seen so far among nodes that were allowed to stay. If the current node's old index is at least that, it stays and raises the watermark. If it is below, it is behind a node that is already settled, so it has to move: flag `Placement`.

A new fiber (`alternate === null`) is always a `Placement` too. The flag is overloaded: at commit `commitHostPlacement` runs for both cases, and `insertBefore`/`appendChild` both insert a new node and move an existing one.

### Deletions

`deleteChild` never touches the DOM. It pushes onto an array on the parent and sets one bit:

```js
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      // Noop.
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }
```

The commit phase drains that array before descending into children, so unmounts run before the new children's effects (`recursivelyTraverseMutationEffects`, section 6).

### Worked examples

All five were traced through the source and then confirmed against React 19.3.0 in jsdom, by patching `Node.prototype.insertBefore`/`appendChild` on the parent `<ul>` and checking which DOM nodes survived by identity. Keys are the letters.

**Append, `[a,b]` → `[a,b,c]`.** Pass 1 matches `a` (old index 0, `lastPlacedIndex` 0→0) and `b` (old index 1, →1). `oldFiber` is now `null`, so the insertion fast path runs: `c` is created, `alternate === null` → `Placement`. Observed DOM ops: `appendChild(c)`. Nodes `a` and `b` reused.

**Prepend, `[a,b]` → `[c,a,b]`.** Pass 1 bails immediately: old key `a`, new key `c`. Map is `{a:0, b:1}`. `c` misses → new fiber → `Placement`, `lastPlacedIndex` stays 0. `a` matches (old index 0, not `< 0`) → stays, `lastPlacedIndex` 0. `b` matches (old index 1) → stays, `lastPlacedIndex` 1. Observed: `insertBefore(c, a)`. Only one DOM mutation, both existing nodes reused. This is exactly what the legacy doc promises keys buy you.

**Rotate, `[a,b,c]` → `[c,a,b]`.** Pass 1 bails at index 0. Map is `{a:0, b:1, c:2}`. `c` first: old index 2, not `< 0` → stays, `lastPlacedIndex` becomes **2**. Then `a`: old index 0 `< 2` → `Placement`. Then `b`: old index 1 `< 2` → `Placement`. Observed: `appendChild(a)`, `appendChild(b)` — two moves where one (`c` to the front) would have done. All three nodes reused, but React picked the wrong anchor. This is the price of having no longest-increasing-subsequence pass.

**Reverse, `[a,b,c]` → `[c,b,a]`.** Same shape: `c` sets `lastPlacedIndex` to 2, then `b` (1 < 2) and `a` (0 < 2) both get `Placement`. Observed: two `appendChild` calls. `n-1` moves, which is optimal here.

**Delete in the middle, `[a,b,c]` → `[a,c]`.** Pass 1 matches `a`, then bails at index 1 (old key `b`, new key `c`). Map built from `b` onward: `{b:1, c:2}`. `c` matches, old index 2, not `< 0` → stays, and is removed from the map. `b` is left over, so `deleteChild(parent, b)` sets `ChildDeletion` on the `<ul>` fiber and pushes `b` onto `deletions`. Observed: zero insert/append calls (the only DOM op is the `removeChild` for `b`, which the probe did not instrument). `a` and `c` reused in place.

**Where the docs simplify.** The legacy doc's "Recursing On Children" section says React "just iterates over both lists of children at the same time and generates a mutation whenever there's a difference", and that inserting at the front makes React "mutate every child" [[legacy doc][doc-recon]]. That is a faithful description of pass 1 only, and of the unkeyed case. It does not mention pass 2, the map, or `lastPlacedIndex`. With keys, the behaviour is the prepend example above. Without keys, the doc's description is correct: unkeyed children match by index, so prepending shifts every element's props by one slot and every DOM node gets rewritten in place.

---

## 5. Bailouts: the part that actually makes React fast

The diff described above only runs if React enters the component at all. Most of the time it does not.

`packages/react-reconciler/src/ReactFiberBeginWork.js`, top of `beginWork`:

```js
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (
      oldProps !== newProps ||
      hasLegacyContextChanged() ||
      // Force a re-render if the implementation changed due to hot reload:
      (__DEV__ ? workInProgress.type !== current.type : false)
    ) {
      // If props or context changed, mark the fiber as having performed work.
      // This may be unset if the props are determined to be equal later (memo).
      didReceiveUpdate = true;
    } else {
      // Neither props nor legacy context changes. Check if there's a pending
      // update or context change.
      const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLanes,
      );
      if (
        !hasScheduledUpdateOrContext &&
        (workInProgress.flags & DidCapture) === NoFlags
      ) {
        // No pending updates or context. Bail out now.
        didReceiveUpdate = false;
        return attemptEarlyBailoutIfNoScheduledUpdate(
          current,
          workInProgress,
          renderLanes,
        );
      }
      ...
```

`oldProps !== newProps` is object identity. JSX allocates a fresh props object on every render, so this is only equal when React itself reused the fiber without re-rendering the parent's JSX, or when `memo`/`useMemo` kept the same element or props object alive.

The second condition is the lane check:

```js
function checkScheduledUpdateOrContext(
  current: Fiber,
  renderLanes: Lanes,
): boolean {
  // Before performing an early bailout, we must check if there are pending
  // updates or context.
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) {
    return true;
  }
  // No pending update, but because context is propagated lazily, we need
  // to check for a context change before we bail out.
  const dependencies = current.dependencies;
  if (dependencies !== null && checkIfContextChanged(dependencies)) {
    return true;
  }
  return false;
}
```

And then the subtree check, in `bailoutOnAlreadyFinishedWork`:

```js
markSkippedUpdateLanes(workInProgress.lanes);

// Check if the children have any pending work.
if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
	// The children don't have any work either. We can skip them.
	if (current !== null) {
		// Before bailing out, check if there are any context changes in
		// the children.
		lazilyPropagateParentContextChanges(current, workInProgress, renderLanes);
		if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
			return null;
		}
	} else {
		return null;
	}
}

// This fiber doesn't have work, but its subtree does. Clone the child
// fibers and continue.
cloneChildFibers(current, workInProgress);
return workInProgress.child;
```

`childLanes` is the union of every descendant's pending lanes, maintained bottom-up by `bubbleProperties` during `completeWork` (see section 6). Returning `null` tells the work loop "this subtree is done", and the entire subtree is skipped: no render functions called, no children reconciled, no flags set, and because `workInProgress.child` still points at `current.child`, the committed tree simply keeps the old fibers.

When the fiber itself is clean but something deeper is dirty, `cloneChildFibers` walks one level of siblings and calls `createWorkInProgress` on each with their _existing_ `pendingProps`. That is why `bubbleProperties` can detect a bailout later:

```js
const didBailout = completedWork.alternate !== null && completedWork.alternate.child === completedWork.child;
```

**Why this is the real story.** A `setState` deep in a large tree marks lanes on that fiber and walks up setting `childLanes` on ancestors. The next render starts at the root, but every ancestor whose props are identical and whose `childLanes` misses the render lanes returns `null` immediately. React only re-renders the path from the root to the updater, plus that updater's subtree. The child-list algorithm from section 4 is what happens _inside_ the components that do re-render, and it is comparatively rare.

The practical corollary: `React.memo`, stable callback identities, and lifting state down are optimisations because they make `oldProps !== newProps` false. They are not "helping the diff go faster", they are removing the diff.

---

## 6. Flags and the commit phase

### The flags

`packages/react-reconciler/src/ReactFiberFlags.js` defines them as bits on a 31-bit integer. The ones relevant to DOM mutation:

```js
export const NoFlags = /*                      */ 0b0000000000000000000000000000000;
export const PerformedWork = /*                */ 0b0000000000000000000000000000001;
export const Placement = /*                    */ 0b0000000000000000000000000000010;
...
export const Update = /*                       */ 0b0000000000000000000000000000100;
export const Cloned = /*                       */ 0b0000000000000000000000000001000;

export const ChildDeletion = /*                */ 0b0000000000000000000000000010000;
export const ContentReset = /*                 */ 0b0000000000000000000000000100000;
export const Callback = /*                     */ 0b0000000000000000000000001000000;
...
export const Ref = /*                          */ 0b0000000000000000000001000000000;
export const Snapshot = /*                     */ 0b0000000000000000000010000000000;
export const Passive = /*                      */ 0b0000000000000000000100000000000;
```

Note there is no `Deletion` flag on the deleted node. Since [PR #20264][pr20264] ("Add separate ChildDeletion flag", commit `369c3db62`, 2020-11-16) the flag lives on the **parent**, and the deleted fibers live in `parentFiber.deletions`. That matters because a deleted fiber is not part of the work-in-progress tree at all, so it has nowhere to carry a flag.

The masks that drive the commit walk:

```js
export const MutationMask =
	Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility | FormReset;
export const LayoutMask = Update | Callback | Ref | Visibility;
export const PassiveMask = Passive | Visibility | ChildDeletion;
```

### `subtreeFlags` replaced the effect list

In React 16 and 17 the commit phase walked a singly-linked list threaded through the fiber tree (`firstEffect`/`lastEffect`/`nextEffect`), built during `completeWork`. That is gone. Today each fiber carries `subtreeFlags`, the OR of every descendant's `flags` and `subtreeFlags`, computed bottom-up in `bubbleProperties` (`ReactFiberCompleteWork.js`):

```js
let child = completedWork.child;
while (child !== null) {
	newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));

	subtreeFlags |= child.subtreeFlags;
	subtreeFlags |= child.flags;

	// Update the return pointer so the tree is consistent. This is a code
	// smell because it assumes the commit phase is never concurrent with
	// the render phase. Will address during refactor to alternate model.
	child.return = completedWork;

	child = child.sibling;
}
```

Note it bubbles `childLanes` in the same loop, which is the field section 5 relies on.

The commit walk is then a plain depth-first traversal that prunes on the mask:

`packages/react-reconciler/src/ReactFiberCommitWork.js`:

```js
function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes,
) {
  // Deletions effects can be scheduled on any fiber type. They need to happen
  // before the children effects have fired.
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      commitDeletionEffects(root, parentFiber, childToDelete);
    }
  }

  if (parentFiber.subtreeFlags & (MutationMask | Cloned)) {
    let child = parentFiber.child;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root, lanes);
      child = child.sibling;
    }
  }
}
```

One `&` per node decides whether a whole subtree is visited. That is the same pruning the effect list gave, with two advantages: the tree can be walked in more than one order (before-mutation, mutation, layout, passive each use their own mask), and nothing has to be threaded or reset.

The relevant commits, in order:

| Commit      | Date       | PR                | What                                                                                                                                           |
| ----------- | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `d2e914ab4` | 2020-08-21 | [#19673][pr19673] | Remove remaining references to effect list                                                                                                     |
| `de75315d7` | 2020-11-16 | —                 | Track deletions using an array on the parent ("an incremental step away from using the effect list and toward a DFS + subtreeFlags traversal") |
| `369c3db62` | 2020-11-16 | [#20264][pr20264] | Add separate `ChildDeletion` flag                                                                                                              |
| `b66ae09b6` | 2020-11-17 | [#19836][pr19836] | Track `subtreeFlags` et al with `bubbleProperties`                                                                                             |
| `fceb75e89` | 2021-01-20 | [#20625][pr20625] | Delete remaining references to effect list                                                                                                     |

All five landed before React 18, so `subtreeFlags` is not a React 19 change.

### The three sub-phases

`packages/react-reconciler/src/ReactFiberWorkLoop.js`, in `commitRoot` and the `flush*` functions. Each is gated on its own mask before it runs at all:

```js
  const subtreeHasBeforeMutationEffects =
    (finishedWork.subtreeFlags & (BeforeMutationMask | MutationMask)) !==
    NoFlags;
  const rootHasBeforeMutationEffect =
    (finishedWork.flags & (BeforeMutationMask | MutationMask)) !== NoFlags;

  if (subtreeHasBeforeMutationEffects || rootHasBeforeMutationEffect) {
    ...
      // The first phase a "before mutation" phase. We use this phase to read the
      // state of the host tree right before we mutate it. This is where
      // getSnapshotBeforeUpdate is called.
      commitBeforeMutationEffects(root, finishedWork, lanes);
```

```js
  const subtreeMutationHasEffects =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootMutationHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subtreeMutationHasEffects || rootMutationHasEffect) {
    ...
      // The next phase is the mutation phase, where we mutate the host tree.
      commitMutationEffects(root, finishedWork, lanes);
      ...
      resetAfterCommit(root.containerInfo);
```

```js
  const subtreeHasLayoutEffects =
    (finishedWork.subtreeFlags & LayoutMask) !== NoFlags;
  const rootHasLayoutEffect = (finishedWork.flags & LayoutMask) !== NoFlags;

  if (subtreeHasLayoutEffects || rootHasLayoutEffect) {
    ...
      // The next phase is the layout phase, where we call effects that read
      // the host tree after it's been mutated. The idiomatic use case for this is
      // layout, but class component lifecycles also fire here for legacy reasons.
      ...
      commitLayoutEffects(finishedWork, root, lanes);
```

| Phase           | Runs                                                                                                                                                                                  | DOM state              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Before mutation | `prepareForCommit` (saves selection/focus, disables event system), `getSnapshotBeforeUpdate` on classes (`Snapshot` flag)                                                             | old tree, untouched    |
| Mutation        | deletions (`ChildDeletion`), placements (`Placement`), prop updates (`Update` → `commitUpdate`), text updates, `ContentReset`, ref detach; then `resetAfterCommit` restores selection | being rewritten        |
| Layout          | `componentDidMount`/`componentDidUpdate`, `useLayoutEffect` create, ref attach, `setState` callbacks                                                                                  | new tree, before paint |

Passive effects (`useEffect`) are a fourth pass, scheduled after paint, gated on `PassiveMask`.

`root.current = finishedWork` happens between mutation and layout, as quoted in section 1. So `componentWillUnmount` sees the old tree as current, and `componentDidMount` sees the new one.

Placement is applied inside the mutation walk, after children and before this fiber's own update:

```js
function commitReconciliationEffects(
  finishedWork: Fiber,
  committedLanes: Lanes,
) {
  // Placement effects (insertions, reorders) can be scheduled on any fiber
  // type. They needs to happen after the children effects have fired, but
  // before the effects on this fiber have fired.
  const flags = finishedWork.flags;
  if (flags & Placement) {
    commitHostPlacement(finishedWork);
    // Clear the "placement" from effect tag so that we know that this is
    // inserted, before any life-cycles like componentDidMount gets called.
    finishedWork.flags &= ~Placement;
  }
  ...
```

---

## 7. Where React does read the real DOM

Four places. None of them is the diff.

### 7.1 Hydration matching

On the first client render over server HTML, React has no `current` tree, so it walks the existing DOM as the "previous" side. `tryToClaimNextHydratableInstance` (`packages/react-reconciler/src/ReactFiberHydrationContext.js`) pulls the next candidate node and asks the host config whether it fits:

```js
function tryToClaimNextHydratableInstance(fiber: Fiber): void {
  if (!isHydrating) {
    return;
  }
  const currentHostContext = getHostContext();
  const shouldKeepWarning = validateHydratableInstance(
    fiber.type,
    fiber.pendingProps,
    currentHostContext,
  );

  const nextInstance = nextHydratableInstance;
  if (
    !nextInstance ||
    !tryHydrateInstance(fiber, nextInstance, currentHostContext)
  ) {
    if (shouldKeepWarning) {
      warnNonHydratedInstance(fiber, nextInstance);
    }
    throwOnHydrationMismatch(fiber);
  }
}
```

Candidates come from `getFirstHydratableChild`/`getNextHydratableSibling`, which are literally `firstChild`/`nextSibling` walks filtered to element and text nodes (`ReactFiberConfigDOM.js`). The tag check is in `canHydrateInstance`:

```js
export function canHydrateInstance(
  instance: HydratableInstance,
  type: string,
  props: Props,
  inRootOrSingleton: boolean,
): null | Instance {
  while (instance.nodeType === ELEMENT_NODE) {
    const element: Element = instance as any;
    const anyProps = props as any;
    if (element.nodeName.toLowerCase() !== type.toLowerCase()) {
      ...
```

Text content is compared for real, in production too (`hydrateProperties` in `ReactDOMComponent.js`):

```js
if (typeof children === "string" || typeof children === "number" || typeof children === "bigint") {
	if (
		domElement.textContent !== "" + children &&
		props.suppressHydrationWarning !== true &&
		!checkForUnmatchedText(domElement.textContent, children)
	) {
		return false;
	}
}
```

Attributes are a different story. `diffHydratedProperties` reads `domElement.attributes` and builds a `serverDifferences` object, but the whole body of that work sits inside `if (__DEV__)`:

```js
export function diffHydratedProperties(
  domElement: Element,
  tag: string,
  props: Object,
  hostContext: HostContext,
): null | Object {
  const serverDifferences: {[propName: string]: mixed} = {};
  if (__DEV__) {
    const extraAttributes: Set<string> = new Set();
    const attributes = domElement.attributes;
    ...
  }
  if (Object.keys(serverDifferences).length === 0) {
    return null;
  }
  return serverDifferences;
}
```

and it is reached only through `diffHydratedPropsForDevWarnings`. So: in production React 19 checks tag names and text content against the DOM during hydration, and reports attribute mismatches only in development. A failed match throws `HydrationMismatchException`, which surfaces as the familiar error and causes the tree to be re-rendered on the client:

```js
  const error = new Error(
    `Hydration failed because the server rendered ${fromText ? 'text' : 'HTML'} didn't match the client. As a result this tree will be regenerated on the client. ...
```

### 7.2 Selection and focus, saved and restored around mutation

React reads `document.activeElement` and the current selection range before mutating, and puts them back afterwards. Entry point is `prepareForCommit`, called as the first line of `commitBeforeMutationEffects` (`ReactFiberCommitWork.js`):

```js
focusedInstanceHandle = prepareForCommit(root.containerInfo);
```

`packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js`:

```js
export function prepareForCommit(containerInfo: Container): Object | null {
  eventsEnabled = ReactBrowserEventEmitterIsEnabled();
  selectionInformation = getSelectionInformation(containerInfo);
  ...
  ReactBrowserEventEmitterSetEnabled(false);
  return activeInstance;
}

export function resetAfterCommit(containerInfo: Container): void {
  restoreSelection(selectionInformation, containerInfo);
  ReactBrowserEventEmitterSetEnabled(eventsEnabled);
  eventsEnabled = null;
  selectionInformation = null;
}
```

`resetAfterCommit` is called at the end of `flushMutationEffects`. The reads themselves are in `packages/react-dom-bindings/src/client/ReactInputSelection.js`:

```js
export function getSelectionInformation(containerInfo) {
	const focusedElem = getActiveElementDeep(containerInfo);
	return {
		focusedElem: focusedElem,
		selectionRange: hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null,
	};
}

export function restoreSelection(priorSelectionInformation, containerInfo) {
	const curFocusedElem = getActiveElementDeep(containerInfo);
	const priorFocusedElem = priorSelectionInformation.focusedElem;
	const priorSelectionRange = priorSelectionInformation.selectionRange;
	if (curFocusedElem !== priorFocusedElem && isInDocument(priorFocusedElem)) {
		if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
			setSelection(priorFocusedElem, priorSelectionRange);
		}

		// Focusing a node can change the scroll position, which is undesirable
		const ancestors = [];
		let ancestor = priorFocusedElem;
		while ((ancestor = ancestor.parentNode)) {
			if (ancestor.nodeType === ELEMENT_NODE) {
				ancestors.push({
					element: ancestor,
					left: ancestor.scrollLeft,
					top: ancestor.scrollTop,
				});
			}
		}

		if (typeof priorFocusedElem.focus === "function") {
			priorFocusedElem.focus();
		}

		for (let i = 0; i < ancestors.length; i++) {
			const info = ancestors[i];
			info.element.scrollLeft = info.left;
			info.element.scrollTop = info.top;
		}
	}
}
```

It also reads and restores every ancestor's scroll position, because calling `focus()` can scroll them.

This is a genuine DOM read, and it exists precisely because the mutation phase moves nodes around: a `Placement` that re-inserts the focused input would otherwise drop focus and selection.

### 7.3 `getSnapshotBeforeUpdate`

The before-mutation phase exists so class components can read the DOM while it still shows the old tree. `packages/react-reconciler/src/ReactFiberCommitEffects.js`:

```js
export function commitClassSnapshot(finishedWork: Fiber, current: Fiber) {
  const prevProps = current.memoizedProps;
  const prevState = current.memoizedState;
  const instance = finishedWork.stateNode;
  ...
  return instance.getSnapshotBeforeUpdate(prevProps, prevState);
}
```

React does not read the DOM here itself. It gives user code a window in which the DOM still matches `current`. The classic use is capturing `scrollHeight` before a list grows.

### 7.4 Refs

Refs are handed out during the layout phase, from the stored `stateNode`:

```js
function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    let instanceToUse;
    switch (finishedWork.tag) {
      case HostHoistable:
      case HostSingleton:
      case HostComponent:
        instanceToUse = getPublicInstance(finishedWork.stateNode);
        break;
      ...
```

Strictly this is not React reading the DOM. It is React passing the node it already holds to user code, which may then read it. Worth listing because it is the sanctioned way for application code to do what React itself does not: measure the live DOM.

---

## 8. Summary of the corrections

1. **"React diffs the virtual DOM against the real DOM"** — no. It diffs the newly returned element tree against the previous **fiber** tree, held entirely in memory and reached through `current` / `alternate`. The DOM is written to, and read only for hydration, selection/focus restore, and whatever user code does with a ref or in `getSnapshotBeforeUpdate`.

2. **"`prepareUpdate` produces an update payload"** — that was React 18 and earlier. Removed in commit `7f6201889` ([PR #27409][pr27409]). React 19's `completeWork` sets `Update` on `oldProps !== newProps` and nothing more; the per-prop comparison happens inside `commitUpdate` → `updateProperties` at commit time. `prepareUpdate` does not exist in the `v19.3.0` source.

3. **"The diff is where React spends its time"** — usually not. `beginWork` returns `null` for any fiber whose props are reference-equal and whose `childLanes` miss the current render lanes, skipping the subtree entirely. Memoisation works by making that check pass, not by making the diff faster.

4. **"Keys let React reorder optimally"** — keys let React _reuse_ the right fibers and DOM nodes, which is the important half. The move set is not minimal: `lastPlacedIndex` is a single forward watermark with no longest-increasing-subsequence pass, so `[a,b,c]` → `[c,a,b]` moves two nodes where one would do (verified in jsdom against 19.3.0). The source comments acknowledge the tradeoff.

5. **The effect list is long gone.** The commit phase is a depth-first walk pruned by `subtreeFlags`, introduced by [PR #19836][pr19836] and finished by [PR #20625][pr20625] in early 2021 — before React 18, not in 19.

6. **Deletions are recorded on the parent**, as `parentFiber.deletions` plus a `ChildDeletion` flag ([PR #20264][pr20264]). There is no `Deletion` flag on the removed fiber, because a removed fiber is not in the work-in-progress tree.

---

## Unverified / out of scope

- The `enableOptimisticKey` branches throughout `ReactChildFiber.js` are behind a feature flag; I did not check whether it is on in the stable 19.3.0 build, so the `REACT_OPTIMISTIC_KEY` paths are quoted but not claimed as active behaviour.
- `reconcileChildrenIteratable` and `reconcileChildrenAsyncIteratable` are said by the source comment to use "the same algorithm" as `reconcileChildrenArray`. I read the array version only and did not verify the iterator versions line by line.
- The persistent-renderer path (`supportsPersistence`, used by React Native Fabric) is quoted where it sits next to the mutation path but was not studied.
- View Transition flags (`ViewTransitionStatic`, `BeforeAndAfterMutationTransitionMask`) change which subtrees the before-mutation walk visits when `enableViewTransition` is on. Not investigated.
- The exact commit that introduced `subtreeFlags` is given as `b66ae09b6` / [PR #19836][pr19836] based on the commit message ("Original PR: #19836"). I did not open the PR itself.

---

## Primary sources

- React source, tag `v19.3.0` (commit `1d34f91dfde6bba84d08b683aaba164c7194dacb`) — [`react-reconciler/src`][rr], [`react-dom-bindings/src/client`][rdb]
  - [`ReactChildFiber.js`][cf] — `reconcileChildFibers`, `reconcileChildrenArray`, `reconcileSingleElement`, `createChild`, `updateSlot`, `updateFromMap`, `mapRemainingChildren`, `placeChild`, `deleteChild`, `deleteRemainingChildren`, `useFiber`, `cloneChildFibers`
  - [`ReactFiber.js`][fiber] — `createWorkInProgress`
  - [`ReactFiberBeginWork.js`][bw] — `beginWork`, `checkScheduledUpdateOrContext`, `attemptEarlyBailoutIfNoScheduledUpdate`, `bailoutOnAlreadyFinishedWork`, `updateHostComponent`
  - [`ReactFiberCompleteWork.js`][cw] — `completeWork`, `updateHostComponent`, `markUpdate`, `bubbleProperties`
  - [`ReactFiberCommitWork.js`][cmw] — `commitBeforeMutationEffects`, `recursivelyTraverseMutationEffects`, `commitMutationEffectsOnFiber`, `commitReconciliationEffects`
  - [`ReactFiberCommitHostEffects.js`][cmh] — `commitHostUpdate`, `getHostSibling`
  - [`ReactFiberCommitEffects.js`][cme] — `commitClassSnapshot`, `commitAttachRef`
  - [`ReactFiberWorkLoop.js`][wl] — `commitRoot`, `flushMutationEffects`, `flushLayoutEffects`
  - [`ReactFiberFlags.js`][flags] — flag bits and masks
  - [`ReactFiberHydrationContext.js`][hyd] — `tryToClaimNextHydratableInstance`, `throwOnHydrationMismatch`
  - [`ReactFiberConfigDOM.js`][cfg] — `commitUpdate`, `prepareForCommit`, `resetAfterCommit`, `canHydrateInstance`, `getFirstHydratableChild`, `hydrateInstance`, `finalizeInitialChildren`
  - [`ReactDOMComponent.js`][rdc] — `updateProperties`, `hydrateProperties`, `diffHydratedProperties`
  - [`ReactInputSelection.js`][sel] — `getSelectionInformation`, `restoreSelection`
- React source, tag `v18.3.1` (commit `f1338f8080abd1386454a10bbf93d67bfe37ce85`) — [`ReactFiberCompleteWork.new.js`][cw18], [`ReactDOMHostConfig.js`][hc18], [`ReactDOMComponent.js`][rdc18]
- Commits and PRs: [#27409 diff in commit phase][pr27409], [#19673][pr19673], [#20264][pr20264], [#19836][pr19836], [#20625][pr20625]
- Docs, cited for stated intent only: [legacy Reconciliation][doc-recon] (simplifies the child algorithm, see section 4), [Preserving and Resetting State][doc-state] (no pseudo-code, states the position/key rules)
- Local verification: React 19.3.0 + jsdom, patching `Node.prototype.insertBefore`/`appendChild` on the list parent to record DOM ops, and comparing child node identity before and after. Five cases in section 4.

[rr]: https://github.com/facebook/react/tree/v19.3.0/packages/react-reconciler/src
[rdb]: https://github.com/facebook/react/tree/v19.3.0/packages/react-dom-bindings/src/client
[cf]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactChildFiber.js
[fiber]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiber.js
[bw]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberBeginWork.js
[cw]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberCompleteWork.js
[cmw]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberCommitWork.js
[cmh]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberCommitHostEffects.js
[cme]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberCommitEffects.js
[wl]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberWorkLoop.js
[flags]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberFlags.js
[hyd]: https://github.com/facebook/react/blob/v19.3.0/packages/react-reconciler/src/ReactFiberHydrationContext.js
[cfg]: https://github.com/facebook/react/blob/v19.3.0/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
[rdc]: https://github.com/facebook/react/blob/v19.3.0/packages/react-dom-bindings/src/client/ReactDOMComponent.js
[sel]: https://github.com/facebook/react/blob/v19.3.0/packages/react-dom-bindings/src/client/ReactInputSelection.js
[cw18]: https://github.com/facebook/react/blob/v18.3.1/packages/react-reconciler/src/ReactFiberCompleteWork.new.js
[hc18]: https://github.com/facebook/react/blob/v18.3.1/packages/react-dom/src/client/ReactDOMHostConfig.js
[rdc18]: https://github.com/facebook/react/blob/v18.3.1/packages/react-dom/src/client/ReactDOMComponent.js
[pr27409]: https://github.com/facebook/react/pull/27409
[pr19673]: https://github.com/facebook/react/pull/19673
[pr20264]: https://github.com/facebook/react/pull/20264
[pr19836]: https://github.com/facebook/react/pull/19836
[pr20625]: https://github.com/facebook/react/pull/20625
[doc-recon]: https://legacy.reactjs.org/docs/reconciliation.html
[doc-state]: https://react.dev/learn/preserving-and-resetting-state
