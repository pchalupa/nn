# Legend State: `useSyncExternalStore` and `getSnapshot`

Researched 2026-09-22. Read from the GitHub source, not from published bundles:

- **v3 (beta)**: `main` at commit [`23b5dde`](https://github.com/LegendApp/legend-state/commit/23b5ddeb87598082987aa475dee1586d54328034) (2026-08-11), `package.json` version `3.0.0-beta.48`. All v3 permalinks below are pinned to that commit.
- **v2 (stable)**: tag [`v2.1.15`](https://github.com/LegendApp/legend-state/tree/v2.1.15).
- **React**: [`v19.2.0`](https://github.com/facebook/react/tree/v19.2.0), for the built-in `useSyncExternalStore` and the `use-sync-external-store` shim it publishes.
- Docs: <https://legendapp.com/open-source/state/v3/react/react-api/> and <https://legendapp.com/open-source/state/v3/intro/fast/>.

This is a companion to `snapshot-creation-in-zustand-and-react-query.md`. Zustand and React Query both put a _value_ in `getSnapshot` and then work hard to keep that value referentially stable. Legend State does not. It puts a **counter** there, and that single decision removes the entire class of problem the other note is about.

---

## 1. Yes, it uses `useSyncExternalStore` — in exactly one place

Across all of v3's React surface there is a single call site:

```
$ grep -rn "useSyncExternalStore" src/react/
src/react/useSelector.ts:12:import { useSyncExternalStore } from 'use-sync-external-store/shim/index.js';
src/react/useSelector.ts:163:        useSyncExternalStore(subscribe, getVersion, getVersion);
```

Everything else funnels through `useSelector`:

- `observer(Component)` wraps the whole render in `useSelector(() => Reflect.apply(...), { skipCheck: true })` ([reactive-observer.tsx#L176-L188](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/reactive-observer.tsx#L176-L188)).
- `reactive(Component)` wraps prop resolution in another `useSelector(..., { skipCheck: true })` ([same file, #L92-L172](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/reactive-observer.tsx#L92-L172)).
- `Computed` is a one-liner over `useSelector`, and `Memo` is `memo(Computed)` ([Computed.tsx](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/Computed.tsx), [Memo.tsx](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/Memo.tsx)).
- `For` uses `useSelector` with a shallow listener ([For.tsx#L32-L34](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/For.tsx#L32-L34)).

So the reported "v3 moved to a custom `useSyncExternalStore`-like implementation with its own `forceRender`" is **not true of `main` at the commit I read**. v3 still uses the real hook. What it does have is a layer of scheduling in front of the notify callback, which section 7 covers, and which is probably what that claim refers to. I could not verify what any intermediate beta did.

`use-sync-external-store/shim/index.js` is a dependency in both v2 and v3 (`"use-sync-external-store": "^1.2.2"`). The shim re-exports React's built-in hook when it exists and only falls back to the userland implementation on React 17 and below ([useSyncExternalStoreShim.js#L17-L21](https://github.com/facebook/react/blob/v19.2.0/packages/use-sync-external-store/src/useSyncExternalStoreShim.js#L17-L21)), so on React 18/19 Legend State gets the real concurrent-safe hook.

---

## 2. `getSnapshot` returns a version number

This is the whole trick. `createSelectorFunctions` closes over `let version = 0` and hands React `getVersion` ([useSelector.ts#L27](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L27), [#L122](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L122)):

```ts
value = runInRender(() => run(selector) as any);

useSyncExternalStore(subscribe, getVersion, getVersion);

// ...
return value;
```

([useSelector.ts#L161-L183](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L161-L183))

Three things fall out of this, and they are worth stating separately.

**The return value of `useSyncExternalStore` is discarded.** Like React Query's `useBaseQuery`, the hook is used purely as a subscription plus a tearing check. Unlike React Query, the thing being watched is not the value at all.

**The snapshot is trivially stable and trivially cheap.** `() => version` reads a closure variable. It cannot allocate, cannot fail, and cannot differ between two calls in the same render. React's dev check compares two consecutive `getSnapshot()` calls and warns "The result of getSnapshot should be cached to avoid an infinite loop" if they differ ([ReactFiberHooks.js#L1747-L1757](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactFiberHooks.js#L1747-L1757)). Legend State can never trip it. **There is no cache, because there is nothing to cache.**

**The value is produced during render, not by the snapshot.** `run(selector)` executes the user's selector on _every_ render, with a comment saying exactly why ([#L158-L161](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L158-L161)):

```ts
// Run the selector
// Note: The selector needs to run on every render because it may have different results
// than the previous run if it uses local state
```

So a selector that builds a fresh object every call is _harmless_ here. In Zustand that is the classic infinite loop that `useShallow` exists to fix; in Legend State the snapshot is a number, so React sees no change and never loops. The cost shows up elsewhere (section 9), but the loop is gone by construction.

---

## 3. `subscribe` is nearly empty, because tracking already happened during render

The `subscribe` React gets does not set up any listeners on the normal path ([useSelector.ts#L104-L121](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L104-L121)):

```ts
subscribe: (onStoreChange: () => void) => {
    notify = onStoreChange;

    // Workaround for React 18 running twice in dev (part 2)
    if ((process.env.NODE_ENV === 'development' || ...) && !dispose && resubscribe) {
        dispose = resubscribe();
    }

    return () => {
        dispose?.();
        notify = undefined;
        dispose = undefined;
    };
},
```

All it does is store the callback. The real subscription was created during render, inside `run()`, and the reason is spelled out in `trackSelector` ([trackSelector.ts#L36-L41](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/trackSelector.ts#L36-L41)):

```ts
// useSyncExternalStore doesn't subscribe until after the component mount.
// We want to subscribe immediately so we don't miss any updates
dispose = setupTracking(nodes, updateFn, false, observeOptions?.immediate);
```

The pipeline is:

1. `beginTracking()` pushes a fresh tracking context onto a stack ([tracking.ts#L10-L16](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/tracking.ts#L10-L16)).
2. The selector runs. Every proxy read goes through `get(node, options)`, which calls `updateTracking(node, track)` and then `peek(node)` ([ObservableObject.ts#L1026-L1032](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/ObservableObject.ts#L1026-L1032)). `updateTracking` accumulates a `Map<NodeInfo, TrackingNode>` on the current tracking context ([tracking.ts#L26-L43](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/tracking.ts#L26-L43)).
3. `endTracking()` pops the context and the accessed nodes are handed back.
4. `setupTracking` registers one `onChange` listener per accessed node and returns a disposer that calls them all ([setupTracking.ts](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/setupTracking.ts)).

`onChange` adds the listener to `node.listeners` (or `node.listenersImmediate`), bumps `numListenersRecursive` up the whole parent chain, mirrors the listener onto linked nodes, and returns a teardown that reverses all of it ([onChange.ts#L21-L148](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/onChange.ts#L21-L148)).

`run()` disposes the previous subscription before creating the new one ([useSelector.ts#L53-L67](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L53-L67)), so the dependency set is recomputed from scratch on every render. That is what makes conditional reads work — `x ? a$.get() : b$.get()` resubscribes correctly — and it is the same reason MobX re-derives dependencies per reaction.

**The consequence to notice:** subscribing is a side effect performed during render. React's contract says the opposite. Legend State accepts that on purpose, to close the mount gap that React Query closes differently (by calling `observer.updateResult()` inside its `subscribe` callback). Section 9 covers what it costs.

---

## 4. The version only bumps when the selector's result actually changed

`_update` is the listener installed on every tracked node. Its core ([useSelector.ts#L83-L100](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L83-L100)):

```ts
// If skipCheck then don't need to re-run selector
let changed = options?.skipCheck;
if (!changed) {
	const newValue = run();

	// If newValue is different than previous value then it's changed.
	// Also if the selector returns an observable directly then its value will be the same as
	// the value from the listener, and that should always re-render.
	if (newValue !== prev || (!isPrimitive(newValue) && newValue === value)) {
		changed = true;
	}
}
if (changed) {
	version++;
	scheduleNotify();
}
```

Read the second clause carefully. Legend State mutates state in place — identity is _not_ the change signal, which is the exact opposite of Zustand's copy-on-write. So `newValue !== prev` is false whenever the selector returns an object that was mutated in place. The `newValue === value` clause is the fix: if the selector returned the very object the listener just reported as changed, treat it as changed regardless of identity.

This is the mirror image of the Zustand rule. Zustand can trust identity because it never mutates; Legend State cannot trust identity because it always mutates, so it recovers the signal from "a listener fired on a node I read, and I read that node".

`skipCheck: true` opts out of the check entirely and always bumps. `observer` and `reactive` both pass it, because their "selector" _is_ the component's render function, which must re-run on every change ([reactive-observer.tsx#L186](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/reactive-observer.tsx#L186)). The option exists because of [issue #196](https://github.com/LegendApp/legend-state/issues/196), where `useSelector(() => { obs$.get(); return 1 })` re-rendered on every change; the author's reply is the clearest statement of the tension:

> "It turns out it's actually much harder than expected, because useSelector is used to wrap around rendering the Reactive components. So the selector needs to be run while rendering, so it needs to re-render to run it again... I think it might need to special case rendering components to always re-render while regular selectors can have smarter logic."

Fixed in 1.11.2 by exactly that special case.

**Where the equality work lives.** Note that `_update` calls `run()` — the full selector, with resubscription — _on every notification_, whether or not React ends up rendering. That is eager, like React Query, and unlike our lazy `SnapshotManager.get`. The comparison is a single `!==`, never a deep or shallow equality, which is why it can afford to be eager.

---

## 5. Why no deep equality and no structural cloning are needed

The docs are blunt about the model: "it differs from other Proxy-based systems by not touching the underlying data at all", and "changes only call the few listeners that are affected by that change" (<https://legendapp.com/open-source/state/v3/intro/fast/>).

The code backs it. `get()` is `updateTracking(node) + peek(node)` — it returns the **raw, live, mutable object**, with no clone, no freeze, no proxy wrapper around the result ([ObservableObject.ts#L1026-L1036](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/ObservableObject.ts#L1026-L1036)). Previous values are opt-in via a `getPrevious()` closure rather than eagerly cloned ([batching.ts#L47-L64](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts#L47-L64)); the docs say this directly: "Change handlers have a `getPrevious()` function to opt-in to computing the previous state because cloning objects unnecessarily was wasteful."

The reason it gets away with this is that **the snapshot is not the data**. Zustand, Valtio and React Query all have to make the _value_ satisfy `Object.is` across renders, so they need immutability (Zustand), snapshot cloning (Valtio) or structural sharing plus shallow compare (React Query). Legend State's snapshot is a counter, so the data is free to be mutable, aliased and shared. All the "did anything change" work moved from the read path to the write path, where it is a per-node listener dispatch instead of a value comparison.

The write path does the narrowing. `notify()` collects changes into a batch map, `computeChangesRecursive` walks parents, and `batchNotifyChanges` calls only listeners whose tracking type matches the depth of the change ([batching.ts#L235-L275](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts#L235-L275)):

```ts
const ok = track === true ? level <= 0 : track === optimized ? whenOptimizedOnlyIf && level <= 0 : true;
```

`track === true` is a shallow listener: it fires only when keys are added or removed at that node, not when a grandchild changes. That is what lets `For` re-render the list container only on length changes while each row is its own `observer` ([For.tsx#L32-L34](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/For.tsx#L32-L34)).

---

## 6. `getServerSnapshot`

`getVersion` is passed as both the client and the server snapshot ([useSelector.ts#L163](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L163)). There is no separate server path.

That is coherent given the design: on the server the counter is `0`, on the client's hydrating render React calls `getServerSnapshot` and also gets `0` ([ReactFiberHooks.js#L1736-L1746](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactFiberHooks.js#L1736-L1746)), so there is never a hydration snapshot mismatch. It also means `useSyncExternalStore` contributes nothing to catching a server/client _value_ divergence, because the value is produced by running the selector during render on both sides. Any SSR consistency guarantee here comes from the selector being deterministic, not from React.

---

## 7. Tearing, concurrent rendering, and the render-depth microtask

**Tearing.** React's built-in hook re-reads `getSnapshot` in a layout-phase check and registers a store consistency check that runs right before commit; if the snapshot moved during a concurrent render, it re-renders synchronously ([ReactFiberHooks.js#L1760-L1795](https://github.com/facebook/react/blob/v19.2.0/packages/react-reconciler/src/ReactFiberHooks.js#L1760-L1795)). Because Legend State bumps `version` on any change relevant to this selector, and because `_update` re-runs the selector before deciding, the counter is a faithful "the value I computed during render may now be stale" flag. So tearing protection does work, indirectly: React never compares the rendered value, it compares the counter, and the counter is a correct proxy for it.

There is one gap I want to be explicit about: `run()` during render _reassigns_ `prev` and _replaces_ the listener set. In a concurrent render that React later throws away, that mutation is not rolled back. I did not find a test or an issue demonstrating a concrete failure from this, so I am flagging it as a reading of the code, not a verified bug.

**Notifying during render.** v3 added `reactGlobals.renderDepth` and `runInRender` ([react-globals.ts](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/react-globals.ts)), and `scheduleNotify` uses it ([useSelector.ts#L37-L51](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L37-L51)):

```ts
const scheduleNotify = () => {
	if (notify) {
		if (reactGlobals.renderDepth > 0) {
			if (!notifyQueued) {
				notifyQueued = true;
				queueMicrotask(() => {
					notifyQueued = false;
					notify?.();
				});
			}
		} else {
			notify();
		}
	}
};
```

Since selectors run _during_ render and a selector can activate a synced/computed node that writes back, a notification can fire mid-render. Calling React's `onStoreChange` there would produce "Cannot update a component while rendering a different component". Deferring to a microtask, and coalescing repeats, avoids it. **This is the main v3 change to the React binding**, and v2.1.15 does not have it — v2 calls `notify?.()` directly ([v2.1.15 useSelector.ts#L81-L84](https://github.com/LegendApp/legend-state/blob/v2.1.15/src/react/useSelector.ts#L81-L84)).

**Batching.** Writes inside `batch(fn)` accumulate in `_batchMap` and flush once in `runBatch`, and `batchNotifyChanges` keeps a `listenersNotified` set so a non-tracking listener is called at most once per batch ([batching.ts#L235-L315](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts#L235-L315)). Outside a batch, `notify` runs the batch immediately ([batching.ts#L110-L113](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts#L110-L113)), so unbatched writes notify synchronously. React 18's automatic batching then coalesces the resulting renders; Legend State does not wrap `onStoreChange` in anything like React Query's `notifyManager`.

**Strict mode.** There is an explicit dev-only workaround, in two parts. `trackSelector` builds a `resubscribe` closure, but only in development/test ([trackSelector.ts#L42-L50](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/trackSelector.ts#L42-L50)), and `subscribe` calls it when it finds itself invoked with no live subscription ([useSelector.ts#L107-L114](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L107-L114)). The scenario: StrictMode mounts, runs the effect cleanup (which disposes), then runs the effect setup again — with no render in between, so nothing re-subscribed. Without part 2 the component would be permanently deaf. Shipped code paths in production do not carry this branch, which is fine, because production has no double-invoke.

---

## 8. Trade-offs and caveats

**Selector identity does not matter, and that is unusual.** `createSelectorFunctions` is memoized with `useMemo(..., [])` — an empty dep array — and the selector is passed in on each call as `run(selector)` ([useSelector.ts#L155-L161](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L155-L161)). An inline arrow is the _expected_ usage. Compare with the `with-selector` shim and React Query's `options.select === this.#selectFn` guard, where an inline function silently destroys memoization. Legend State has no memo keyed on the selector, so there is nothing to destroy.

**The price is over-rendering, not looping.** A selector returning a fresh object re-renders on every notification, because `newValue !== prev` is always true. There is no `useShallow` equivalent and no equality option on `UseSelectorOptions`, which is only `{ suspense?, skipCheck? }` plus `GetOptions` ([reactInterfaces.ts#L36-L39](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/reactInterfaces.ts#L36-L39)). The documented answer is granularity instead: read one value per hook, or use `Memo`/`Computed`/`For` to push the boundary down.

**Rendering has side effects.** Subscriptions are created in `run()` during render and torn down in the `subscribe` teardown. If a component renders but never commits — suspends, is discarded, unmounts before effects flush — the listeners registered by that render are never disposed, because `subscribe` never ran. This is the shape of [issue #256](https://github.com/LegendApp/legend-state/issues/256) ("Listener count increases when using `useSelector` / StrictMode"), which is closed. I could not determine from the source whether the non-StrictMode discarded-render case is fully handled; the dev-only `resubscribe` covers the StrictMode pairing specifically.

**Mutation in place versus React Compiler.** The open [issue #653](https://github.com/LegendApp/legend-state/issues/653) is the sharpest illustration of the design's cost. Because `get()` returns the live object and mutations preserve root identity, React Compiler's auto-memoization — which keys on argument identity — can memoize a downstream pure call against an unchanged reference and serve stale results forever. Legend State's own hooks are immune (they don't compare values), but anything _downstream_ that assumes identity means "unchanged" is not.

**React Compiler in general.** The docs state that "`use$` was not compatible with React Compiler, so if you're using Compiler we strongly suggest migrating to `useValue`", and that calling `get()` directly inside `observer` components "is discouraged as of 3.0.0-beta.20" (<https://legendapp.com/open-source/state/v3/react/react-api/>). In the source, `useSelector` is exported under all three names ([useSelector.ts#L186-L187](https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts#L186-L187)):

```ts
export { useSelector as use$ };
export { useSelector as useValue };
```

so the rename is currently an alias, and the compiler incompatibility is about the _call convention_ (`get()` in render, and the `$`-prefixed name) rather than a different implementation.

**Bundler friction.** The hard-coded `'use-sync-external-store/shim/index.js'` CJS import breaks under Vite 8 ([issue #651](https://github.com/LegendApp/legend-state/issues/651), open).

**Not verified.** I found no mention of `useSyncExternalStore`, tearing, or snapshot stability anywhere on the official docs site — this is all implementation detail the docs do not discuss. I also did not check every v3 beta tag, so I cannot rule out that some intermediate beta shipped a hand-rolled subscription and reverted.

---

## 9. What this means for `@nn/store`

Legend State is the third answer to the question the Zustand/React Query note asked, and it is the one neither of those libraries considered:

| Approach         | `getSnapshot` returns  | Stability comes from                           |
| ---------------- | ---------------------- | ---------------------------------------------- |
| Zustand          | the state object       | copy-on-write in the writer                    |
| React Query      | a cached result object | eager compute + `shallowEqualObjects` bail-out |
| **Legend State** | **a version counter**  | **nothing — a number is stable by definition** |

The idea worth taking seriously: **`useSyncExternalStore` does not have to carry the value.** Its job is "tell me when to re-read and check me for tearing". If the value is produced during render anyway — which ours is, since `SnapshotManager.get` recomputes lazily — then a monotonic per-subscription counter is a complete and much cheaper snapshot. Under that model our identity-preserving comparison would stop being a _correctness_ requirement of React's contract and become purely a _re-render_ optimization, which is a much more comfortable place for it to live. We could then make it best-effort, or skip it for shapes where comparison is expensive, without any risk of an infinite loop.

The idea worth _not_ taking: subscribing during render. Legend State does it to close the mount gap, and pays for it with a dev-only StrictMode patch, a `renderDepth` microtask hack, and a render function that is not pure. React Query closes the same gap inside its `subscribe` callback with one `observer.updateResult()` call, which is strictly better behaved. Our `Store` closes it by owning subscriptions from construction.

Two smaller things:

- **In-place mutation makes identity useless as a change signal**, and Legend State has to patch around that with the `newValue === value` clause. This is direct support for the plan's replace-don't-mutate rule and for `Object.freeze` enforcing it.
- **The write-side narrowing is where fine-grained reactivity actually lives.** Legend State's per-node listeners with a `track` level are the mechanism that makes "know which entity changed" concrete. Our `invalidate()` marking everything stale is the coarse version. When we come back to that item, per-node listener sets keyed by the paths a selector read is the shape to copy — not React Query's per-query observers, which are coarser than what our entity graph could support.
