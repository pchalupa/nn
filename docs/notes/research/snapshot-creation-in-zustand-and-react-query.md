# Snapshot creation in Zustand and React Query

Researched 2026-09-22. Read from the published sources: `zustand@5.0.15`, `@tanstack/react-query@5.103.2`, `@tanstack/query-core@5.103.2` and `use-sync-external-store@1.6.0`.

Both libraries feed `useSyncExternalStore`, and both have to solve the same problem we solve in `SnapshotManager`. This document collects the ideas worth stealing, with the code that backs each one.

---

## 1. The rule everything follows from

`useSyncExternalStore` calls `getSnapshot` during render, after every store notification, and again before commit. It compares the results with `Object.is`. So `getSnapshot` has to be:

- **stable**: same value out until the store notifies, or React re-renders forever
- **cheap**: it runs several times per render
- **consistent**: the value must not change under a render in progress, which is the tearing rule

Zustand and React Query both satisfy this, but they put the work in different places. Zustand makes the store's own state naturally stable and keeps `getSnapshot` trivial. React Query cannot do that, because a query result is derived, so it computes the value ahead of time and caches it in an observer.

That is the same fork we already took: our snapshot is derived (a selector runs over live entities), so we are in React Query's half of the world, not Zustand's.

Sources: <https://react.dev/reference/react/useSyncExternalStore>

---

## 2. Zustand: stability by copy-on-write, not by caching

The whole vanilla store is about thirty lines (`zustand/esm/vanilla.mjs`):

```js
const setState = (partial, replace) => {
	const nextState = typeof partial === "function" ? partial(state) : partial;
	if (!Object.is(nextState, state)) {
		const previousState = state;
		state =
			(replace ?? (typeof nextState !== "object" || nextState === null))
				? nextState
				: Object.assign({}, state, nextState);
		listeners.forEach((listener) => listener(state, previousState));
	}
};
const getState = () => state;
```

Two ideas here:

**State identity is the change signal.** Every write produces a new object with `Object.assign`. Nothing is ever mutated in place. So `state !== previousState` means something changed, and `getSnapshot` can be a plain field read. No cache, no comparison, no bookkeeping.

**The bail-out lives in the writer, not the reader.** `setState` returns early on `Object.is`, so listeners never fire for a no-op write. React Query does the same thing in `updateResult`. It is cheaper to decide "nothing changed" once at write time than on every read.

This is the same replace-don't-mutate rule our plan makes into a runtime rule with `Object.freeze`. Zustand only enforces it by convention. Freezing is the stronger version of the same idea.

Sources: `zustand/esm/vanilla.mjs`

---

## 3. Zustand: the selector is the hard part, and v5 gave it back to the user

`zustand/esm/react.mjs` is the whole React binding:

```js
const slice = React.useSyncExternalStore(
	api.subscribe,
	React.useCallback(() => selector(api.getState()), [api, selector]),
	React.useCallback(() => selector(api.getInitialState()), [api, selector]),
);
```

The store is stable, but `selector` is not. A selector like `(s) => ({ a: s.a, b: s.b })` builds a new object on every call, so `getSnapshot` returns a new reference every time and React loops. Zustand v5 does not fix this for you. You wrap the selector yourself:

```js
const { a, b } = useStore(useShallow((s) => ({ a: s.a, b: s.b })));
```

`useShallow` keeps the previous result in a ref and returns it again when the new one is shallow equal. The comparison in `shallow.mjs` handles plain objects, `Map`, `Set` and any iterable, and it checks `Object.getPrototypeOf` first so two different classes never compare equal.

**The idea to take:** identity stability for a derived value is a separate concern from the store, and somebody has to own it. Zustand v5 chose to make it explicit and visible at the call site. We chose the opposite, `SnapshotManager` owns it and the caller does not think about it. Both are defensible. Ours is better here because our selectors return arrays from entities, which is a narrow enough shape to compare well without user help.

Sources: `zustand/esm/react.mjs`, `zustand/esm/vanilla/shallow.mjs`

---

## 4. Zustand v4 and the `with-selector` shim: a two-level memo

`zustand/traditional` still ships the old path, `useSyncExternalStoreWithSelector`. Its memoization is worth reading because it is React's own answer to the same problem (`use-sync-external-store/shim/with-selector`):

```js
function memoizedSelector(nextSnapshot) {
	if (objectIs(memoizedSnapshot, nextSnapshot)) {
		return memoizedSelection; // level 1: raw snapshot unchanged
	}
	const nextSelection = selector(nextSnapshot);
	if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
		memoizedSnapshot = nextSnapshot; // level 2: selection equal, keep the old reference
		return currentSelection;
	}
	memoizedSnapshot = nextSnapshot;
	return (memoizedSelection = nextSelection);
}
```

Three details:

1. **Level one is an identity check on the input.** If the store object did not change, the selector does not run at all. We do not have this, because our `invalidate()` marks everything stale without knowing which entity moved. It is the cheapest possible win and it needs a per-selector record of what it read.
2. **Level two keeps the old reference when the new value is equal.** This is exactly our "recompute, compare, keep the previous value" step.
3. **The memo is rebuilt when `selector` changes**, since `selector` is in the `useMemo` deps. An inline arrow defeats the whole thing. That fragility is why v5 dropped this path, and it is a good argument for keying our cache on something more stable than the selector function itself.

Sources: `use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js`, `zustand/esm/traditional.mjs`

---

## 5. React Query: `getSnapshot` reads a field, the work happens elsewhere

`useBaseQuery` is the interesting one, because a query result can never be stable by construction:

```js
const result = observer.getOptimisticResult(defaultedOptions); // must run before uSES

React.useSyncExternalStore(
	React.useCallback(
		(onStoreChange) => {
			const unsubscribe = shouldSubscribe ? observer.subscribe(notifyManager.batchCalls(onStoreChange)) : noop;
			observer.updateResult();
			return unsubscribe;
		},
		[observer, shouldSubscribe],
	),
	() => observer.getCurrentResult(),
	() => observer.getCurrentResult(),
);

return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
```

**The return value of `useSyncExternalStore` is thrown away.** The hook returns `result`, computed before the call. `useSyncExternalStore` is used only as a subscription and a tearing check. `getCurrentResult()` is a one-line read of a private field.

This is worth sitting with. React Query decided that the snapshot cannot be produced on demand, so it is always produced in advance and stored. `getSnapshot` never computes anything.

Our design is closer to the opposite: `SnapshotManager.get` recomputes lazily during render if the entry is stale. Both work. The trade is that React Query pays the cost on every write even when nobody renders, and we pay it on the first read after a write, but we then need `get` to be re-entrant safe and fast.

**Subscribing is also where the gap is closed.** The `observer.updateResult()` inside the subscribe callback exists because state can change between creating the observer (in `useState`) and subscribing (in the effect). Without it, that window is lost. We have the same window in `Store`, between the constructor subscribing and React's first `getSnapshot`. We happen to be safe because the store owns the subscriptions from construction, but it is the kind of bug that only shows up under load.

Sources: `@tanstack/react-query/src/useBaseQuery.ts`

---

## 6. React Query: layered memoization inside `createResult`

`QueryObserver.createResult` builds the result object, and almost every step has a cache attached (`query-core/src/queryObserver.ts`):

**Structural sharing.** `replaceData` runs `replaceEqualDeep(prevData, data)` unless you turn it off. Unchanged subtrees keep their references across a refetch, so a component reading `data.items[3]` does not re-render when `data.items[0]` changed. This is deeper than our element-wise array comparison. Ours reuses the previous array only when nothing changed at all, theirs reuses the parts that did not change even when something did.

**Selector memoization.**

```js
if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) {
	data = this.#selectResult;
} else {
	data = options.select(data);
	data = replaceData(prevResult?.data, data, options);
	this.#selectResult = data;
}
```

Note the second condition, `options.select === this.#selectFn`. Same problem as the `with-selector` shim, and the same answer: an inline `select` re-runs every time. Their docs tell you to use `useCallback`.

**Placeholder memoization.** If the previous result was placeholder data and the option did not change, the previous `data` is reused directly, and a `skipSelect` flag stops `select` running twice over an already-selected value. Small, but it shows the pattern: every branch that can produce a value has an "is this the same value as last time" guard in front of it.

**The write-side bail-out.** `updateResult` computes the next result and stops before assigning if nothing moved:

```js
if (shallowEqualObjects(nextResult, prevResult)) return;
this.#currentResult = nextResult;
```

That single line is what makes `getCurrentResult()` a valid `getSnapshot`. The stability guarantee lives in one place, and it is a shallow compare of a flat object, which is cheap.

Sources: `@tanstack/query-core/src/queryObserver.ts`, `@tanstack/query-core/src/utils.ts`

---

## 7. React Query: rendering the fresh value and storing it at the same time

`getOptimisticResult` is the piece with no equivalent in our design, and the comment above it explains why it exists:

```js
getOptimisticResult(options) {
	const query = this.#client.getQueryCache().build(this.#client, options);
	const result = this.createResult(query, options);

	if (!shallowEqualObjects(this.getCurrentResult(), result)) {
		this.#currentResult = result;
		this.#currentResultOptions = this.options;
		this.#currentResultState = this.#currentQuery.state;
	}
	return result;
}
```

When the query key changes, the observer is still pointing at the old query's result. If render returned the new result but `getCurrentResult()` kept answering with the old one, the two would disagree and React would see a snapshot mismatch. So reading during render also moves the stored cursor forward.

The general idea: **when the render path computes a value, it must write that value back to wherever `getSnapshot` reads from.** Our `SnapshotManager.get` already does this by storing the recomputed value in the map, so we get it for free. It is good to know the reason, though, because it is easy to "optimize" that write away.

Sources: `@tanstack/query-core/src/queryObserver.ts`

---

## 8. React Query: re-render control sits above the snapshot, not inside it

`useSyncExternalStore` has no equality option. If the snapshot reference changes, you re-render. React Query works around this with two mechanisms that are worth separating in our heads:

**Tracked properties.** With no `notifyOnChangeProps` set, the result is wrapped in a `Proxy` that records which keys you read:

```js
trackResult(result, onPropTracked) {
	return new Proxy(result, {
		get: (target, key) => {
			this.trackProp(key);
			onPropTracked?.(key);
			return Reflect.get(target, key);
		},
	});
}
```

Then `updateResult` only notifies listeners when a tracked key actually changed. A component that reads `data` is not re-rendered when `isFetching` flips.

**Batching.** `notifyManager.batchCalls(onStoreChange)` wraps the React callback, so a burst of cache updates produces one render. Our `Store.update` does the coarse version of this: several mutations in one callback emit `update` once.

The idea: `useSyncExternalStore` gives you correctness, not efficiency. Every re-render optimization is a layer you add on top, either by keeping the snapshot reference stable (our approach, and `useShallow`) or by not notifying at all (tracked props).

Sources: `@tanstack/query-core/src/queryObserver.ts`, `@tanstack/react-query/src/useBaseQuery.ts`

---

## 9. The three shapes of the problem, and what each library does

React Query's own hooks show that the answer depends on what the snapshot is:

| Snapshot shape                 | Example                        | How stability is achieved                                            |
| ------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| A primitive                    | `useIsFetching`                | Nothing needed. `() => client.isFetching(filters)` returns a number. |
| A value the store already owns | Zustand `getState`             | Copy-on-write in the writer. `getSnapshot` is a field read.          |
| A derived value                | `useQuery`, `useMutationState` | Compute, compare with the previous, keep the old reference if equal. |

`useMutationState` is the smallest complete example of the third case, and it does the comparison inside the subscription instead of in an observer:

```js
const result = React.useRef(null);
if (result.current === null) result.current = getResult(mutationCache, options);

return React.useSyncExternalStore(
	React.useCallback(
		(onStoreChange) =>
			mutationCache.subscribe(() => {
				const nextResult = replaceEqualDeep(result.current, getResult(mutationCache, optionsRef.current));
				if (result.current !== nextResult) {
					result.current = nextResult;
					notifyManager.schedule(onStoreChange);
				}
			}),
		[mutationCache],
	),
	() => result.current,
	() => result.current,
);
```

Compute on notify, compare, only then tell React. Same three steps as `SnapshotManager`, in twenty lines.

Sources: `@tanstack/react-query/src/useIsFetching.ts`, `@tanstack/react-query/src/useMutationState.ts`

---

## 10. What this means for `@nn/store`

Confirmed by both libraries:

- Recompute, compare with the previous value, keep the previous reference when equal. Both do it, and neither found a way around it for derived data.
- Bail out at write time, before notifying. Zustand's `Object.is` guard and React Query's `shallowEqualObjects` guard are the same move.
- A selector held by identity is a memoization key, and an inline arrow breaks it. Both libraries hit this, both documented it, and it is the reason our cache key needs thought.
- The value read during render must also be the value stored for `getSnapshot`.

Where we differ on purpose:

- **We freeze.** Zustand relies on convention for replace-don't-mutate. Freezing makes the same rule fail loudly instead of quietly. Nothing in either library does this, which is a cost worth knowing: freezing is not free, and it touches the items the collection holds.
- **We recompute lazily.** React Query computes eagerly on every write. Lazy is the better fit while an update marks every selector stale, since a stale selector nobody renders costs nothing.

Worth considering later, in rough order of value:

1. **Structural sharing inside the array.** `replaceEqualDeep` reuses unchanged parts of a result, not just the whole result. Our element-wise compare is all-or-nothing. The plan already lists this as out of scope, and this is the reference implementation when it comes back.
2. **Know which entity changed.** Both the `with-selector` shim's level-one check and React Query's per-query observers skip work by knowing what moved. Our `invalidate()` marks everything. The plan calls this out under "Not in this step", and it is the right call, but the profile will eventually ask for it.
3. **Property-level tracking.** React Query's `trackResult` proxy is the answer to "the snapshot changed but this component does not care". It is a lot of machinery, and our identity-preserving compare already covers the common case. Not now.

An open question the research did not answer: neither library has a write path attached to the read path, so neither has an opinion on our `update(selector, mutate)` design. React Query's closest thing is `notifyManager.batch`, which batches notifications without owning the mutation.
