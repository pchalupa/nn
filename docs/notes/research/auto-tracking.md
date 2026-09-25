# Auto-tracking in Legend State, MobX and Vue

Researched 2026-09-23. Covers **Vue `@vue/reactivity` 3.5.43** (repo commit `5be58b4`, tag `v3.5.43`), **MobX 6.16.1** (with notes on 7.0.4, which ships the same algorithm with allocation/flag optimisations), and **Legend State 3.0.0-beta.48** (repo commit `23b5ddeb`, the current `next`/beta line; latest stable is 2.1.15). Every mechanism claim below was read out of the shipped source — Vue from a sparse clone of `vuejs/core` at the tag, MobX from the `src/` directory in the npm tarball, Legend State from a clone of `LegendApp/legend-state`. Official docs are cited only where they state intent or guarantees; where a doc page shows simplified pseudo-code (Vue's reactivity-in-depth does) that is flagged explicitly.

---

## 1. Versions, file layout and what each library calls things

|                     | Vue                                                                                                                   | MobX                                                                                                                                                                              | Legend State                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Package             | `@vue/reactivity` 3.5.43                                                                                              | `mobx` 6.16.1                                                                                                                                                                     | `@legendapp/state` 3.0.0-beta.48                                                                   |
| Core files          | `packages/reactivity/src/{effect,dep,computed,baseHandlers,collectionHandlers,arrayInstrumentations,ref,reactive}.ts` | `packages/mobx/src/core/{derivation,observable,atom,computedvalue,reaction,action,globalstate}.ts`, `src/types/{observableobject,observablearray,observablemap,dynamicobject}.ts` | `src/{tracking,trackSelector,setupTracking,onChange,batching,observe,ObservableObject,globals}.ts` |
| Source of a value   | `Dep` (one per object key, plus one per `ref`/`computed`)                                                             | `IObservable` — `Atom`, `ObservableValue`, `ComputedValue`                                                                                                                        | `NodeInfo` — a node in a tree mirroring the data                                                   |
| The reader          | `Subscriber` — `ReactiveEffect` or `ComputedRefImpl`                                                                  | `IDerivation` — `Reaction` or `ComputedValue`                                                                                                                                     | nothing persistent; a `TrackingState` bag that exists only during one run                          |
| "Currently running" | `activeSub` (module-level `let`)                                                                                      | `globalState.trackingDerivation` (+ `trackingContext`)                                                                                                                            | `tracking.current`                                                                                 |
| Link representation | `Link` object, node in two doubly-linked lists                                                                        | `observing_: IObservable[]` / `observers_: Set<IDerivation>`                                                                                                                      | `NodeListener` in `node.listeners: Set<NodeListener>`                                              |

Two structural facts drive almost everything else:

- Vue and MobX both build a **persistent bidirectional dependency graph** and reconcile it after every run. Legend State does not — it converts the read set into plain change-listeners and throws the whole subscription set away on every re-run.
- Vue's 3.5 graph is the result of PR [#10397](https://github.com/vuejs/core/pull/10397) ("Refactor reactivity system to use version counting and doubly-linked list tracking", merged 2024-02-25, inspired by Preact signals), later re-tuned by [#12349](https://github.com/vuejs/core/pull/12349) which ported `alien-signals` 0.4.4. The 3.5 release post only says the refactor "achieves better performance and significantly improved memory usage (**-56%**) with no behavior changes"; the PR body is where the data structure is described.

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/vuejs/core/pull/10397>, <https://github.com/vuejs/core/pull/12349>, <https://blog.vuejs.org/posts/vue-3-5>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/derivation.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/tracking.ts>

---

## 2. The tracking context: what "currently running observer" is

### Vue — one module-level `let`, plus a boolean stack

`packages/reactivity/src/effect.ts`:

```ts
export let activeSub: Subscriber | undefined;

export enum EffectFlags {
	ACTIVE = 1 << 0,
	RUNNING = 1 << 1,
	TRACKING = 1 << 2,
	NOTIFIED = 1 << 3,
	DIRTY = 1 << 4,
	ALLOW_RECURSE = 1 << 5,
	PAUSED = 1 << 6,
	EVALUATED = 1 << 7,
}
```

Nesting is handled by save-and-restore on the call stack, not by a separate stack array:

```ts
run(): T {
	if (!(this.flags & EffectFlags.ACTIVE)) {
		return this.fn()          // stopped: run untracked
	}
	this.flags |= EffectFlags.RUNNING
	cleanupEffect(this)
	prepareDeps(this)
	const prevEffect = activeSub
	const prevShouldTrack = shouldTrack
	activeSub = this
	shouldTrack = true
	try {
		return this.fn()
	} finally {
		cleanupDeps(this)
		activeSub = prevEffect
		shouldTrack = prevShouldTrack
		this.flags &= ~EffectFlags.RUNNING
	}
}
```

`refreshComputed()` does the identical dance (`prevSub = activeSub; activeSub = computed; … finally activeSub = prevSub`), so a computed evaluated inside an effect nests naturally.

A second, independent switch gates tracking without clearing `activeSub`:

```ts
export let shouldTrack = true;
const trackStack: boolean[] = [];

export function pauseTracking(): void {
	trackStack.push(shouldTrack);
	shouldTrack = false;
}
export function resetTracking(): void {
	const last = trackStack.pop();
	shouldTrack = last === undefined ? true : last;
}
```

`cleanupEffect` also nulls `activeSub` around the user cleanup callback, so cleanups never register deps.

### MobX — two globals, because "tracking" and "reactive" are different questions

`packages/mobx/src/core/globalstate.ts`:

```ts
/** Currently running derivation */
trackingDerivation: IDerivation | null = null

/**
 * Currently running reaction. This determines if we currently have a reactive context.
 * (Tracking derivation is also set for temporal tracking of computed values inside actions,
 * but trackingReaction can only be set by a form of Reaction)
 */
trackingContext: Reaction | ComputedValue<any> | null = null
```

`trackingDerivation` answers "should this read be recorded?"; `trackingContext` answers "is there a live reaction at the root of this?" — it is what gates the `onBecomeObserved` hooks and `keepAlive` computed behaviour. `Reaction.track()` sets `trackingContext`, `ComputedValue.get()` sets it only when `keepAlive_` and nothing else has.

The run wrapper is `trackDerivedFunction` (`core/derivation.ts`), which also stacks by save/restore:

```ts
export function trackDerivedFunction<T>(derivation: IDerivation, f: () => T, context: any) {
	const prevAllowStateReads = allowStateReadsStart(true)
	changeDependenciesStateTo0(derivation)
	derivation.newObserving_ = new Array(
		derivation.runId_ === 0 ? 100 : derivation.observing_.length
	)
	derivation.unboundDepsCount_ = 0
	derivation.runId_ = ++globalState.runId
	const prevTracking = globalState.trackingDerivation
	globalState.trackingDerivation = derivation
	globalState.inBatch++
	let result
	…
	globalState.inBatch--
	globalState.trackingDerivation = prevTracking
	bindDependencies(derivation)
	…
}
```

Note `runId_`: every run gets a globally unique id, used as a cheap per-run dedupe (§4). Untracking is implemented by simply nulling the derivation:

```ts
export function untrackedStart(): IDerivation | null {
	const prev = globalState.trackingDerivation;
	globalState.trackingDerivation = null;
	return prev;
}
```

### Legend State — an explicit stack of "bags of nodes"

`src/tracking.ts` is the whole tracking context, 43 lines:

```ts
let trackCount = 0;
const trackingQueue: (TrackingState | undefined)[] = [];

export const tracking = {
	current: undefined as TrackingState | undefined,
};

export function beginTracking() {
	trackingQueue.push(tracking.current);
	trackCount++;
	tracking.current = {};
}
export function endTracking() {
	trackCount--;
	if (trackCount < 0) {
		trackCount = 0;
	}
	tracking.current = trackingQueue.pop();
}

export function updateTracking(node: NodeInfo, track?: TrackingType) {
	if (trackCount) {
		const tracker = tracking.current;
		if (tracker) {
			if (!tracker.nodes) {
				tracker.nodes = new Map();
			}
			const existing = tracker.nodes.get(node);
			if (existing) {
				existing.track = existing.track || track;
				existing.num++;
			} else {
				tracker.nodes.set(node, { node, track, num: 1 });
			}
		}
	}
}
```

The crucial difference: `tracking.current` is **not** a subscriber. It is a `Map<NodeInfo, TrackingNode>` that lives only for the duration of one selector run and is then converted to subscriptions by `setupTracking`. There is no object in Legend State that is "the effect" in the Vue/MobX sense.

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/globalstate.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/derivation.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/tracking.ts>

---

## 3. The interception layer: what actually triggers a track

### Vue — Proxy traps, per-key, plus synthetic iteration keys

`baseHandlers.ts` `BaseReactiveHandler.get` ends with a single `track` call:

```ts
if (!isReadonly) {
	track(target, TrackOpTypes.GET, key);
}
```

and the mutable handler adds three more traps:

```ts
has(target, key): boolean {
	const result = Reflect.has(target, key)
	if (!isSymbol(key) || !builtInSymbols.has(key)) {
		track(target, TrackOpTypes.HAS, key)
	}
	return result
}

ownKeys(target): (string | symbol)[] {
	track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
	return Reflect.ownKeys(target)
}
```

Note `hasOwnProperty` is instrumented separately (`track(obj, TrackOpTypes.HAS, key)`) because it is a method call, not a trap.

Three synthetic keys carry the non-property dependencies (`dep.ts`):

```ts
export const ITERATE_KEY: unique symbol = Symbol(__DEV__ ? "Object iterate" : "");
export const MAP_KEY_ITERATE_KEY: unique symbol = Symbol(__DEV__ ? "Map keys iterate" : "");
export const ARRAY_ITERATE_KEY: unique symbol = Symbol(__DEV__ ? "Array iterate" : "");
```

**Arrays** are the subtle case. Reading `arr[0]` tracks the dep for key `"0"`; reading `arr.length` tracks `"length"`. But `arrayInstrumentations.ts` replaces the iterating methods so they take _one_ dependency on `ARRAY_ITERATE_KEY` instead of N index deps:

```ts
export function shallowReadArray<T>(arr: T[]): T[] {
	track((arr = toRaw(arr)), TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
	return arr;
}
```

`map`/`filter`/`every`/`some`/`forEach`/`reduce`/`join`/`concat`/`entries`/`values`/`Symbol.iterator` all go through it; `indexOf`/`lastIndexOf`/`includes` go through `searchProxy`, which also tracks `ARRAY_ITERATE_KEY` and retries with `toRaw(args[0])` if the proxy-identity lookup fails. The length-mutating methods explicitly _suppress_ tracking:

```ts
// instrument length-altering mutation methods to avoid length being tracked
// which leads to infinite loops in some cases (#2137)
function noTracking(self: unknown[], method: keyof Array<any>, args: unknown[] = []) {
	pauseTracking();
	startBatch();
	const res = (toRaw(self) as any)[method].apply(self, args);
	endBatch();
	resetTracking();
	return res;
}
```

(`push`, `pop`, `shift`, `unshift`, `splice`.)

**Collections** are not proxied via traps but via an instrumentation object (`collectionHandlers.ts`): `get(key)` tracks `GET`+key, `has(key)` tracks `HAS`+key, `size` tracks `ITERATE`+`ITERATE_KEY`, `keys()` tracks `MAP_KEY_ITERATE_KEY`, other iterators track `ITERATE_KEY`. Map keys are tracked twice when the key is itself a proxy (`if (hasChanged(key, rawKey)) track(rawTarget, …, key)` then `track(rawTarget, …, rawKey)`).

`ref`/`computed` skip the WeakMap entirely — they own a `Dep` instance directly and call `this.dep.track()` from the `value` getter.

### MobX — ES getters/setters on the target, with an optional Proxy on top

The per-property interception is a plain accessor pair installed on the object, cached per key (`types/observableobject.ts`):

```ts
function getCachedObservablePropDescriptor(key) {
	return (
		descriptorCache[key] ||
		(descriptorCache[key] = {
			get() {
				return this[$mobx].getObservablePropValue_(key);
			},
			set(value) {
				return this[$mobx].setObservablePropValue_(key, value);
			},
		})
	);
}
```

`getObservablePropValue_` resolves the key to an `ObservableValue` or `ComputedValue` and calls `.get()`, which calls `reportObserved(this)`. So for `makeObservable`/`makeAutoObservable` classes there is **no Proxy at all** — the cost of a tracked read is one getter call plus `reportObserved`.

`observable({...})` additionally wraps the object in a Proxy (`types/dynamicobject.ts`) purely to catch the operations that getters cannot: `has`, `set` of new keys, `deleteProperty`, `defineProperty`, `ownKeys`. Those forward to the administration, where:

- `ownKeys_()` / `keys_()` call `this.keysAtom_.reportObserved()` — one atom for "the key set", exactly analogous to Vue's `ITERATE_KEY`.
- `has_(key)` lazily creates a per-key boolean `ObservableValue` in `pendingKeys_`, but only inside a derivation:

```ts
has_(key: PropertyKey): boolean {
	if (!globalState.trackingDerivation) {
		// Skip key subscription outside derivation
		return key in this.target_
	}
	this.pendingKeys_ ||= new Map()
	let entry = this.pendingKeys_.get(key)
	if (!entry) {
		entry = new ObservableValue(key in this.target_, referenceEnhancer, …, false)
		this.pendingKeys_.set(key, entry)
	}
	return entry.get()
}
```

**Arrays are the coarse case in MobX.** `ObservableArrayAdministration` holds a _single_ atom for the entire array:

```ts
get_(index: number): any | undefined {
	…
	this.atom_.reportObserved()
	return this.dehanceValue_(this.values_[index])
}

getArrayLength_(): number {
	this.atom_.reportObserved()
	return this.values_.length
}
```

Every index read, every `length` read and every array method (`simpleFunc`, `mapLikeFunc`, `reduceLikeFunc` all start with `adm.atom_.reportObserved()`) takes the same dependency. Any write anywhere in the array invalidates every reader. Vue, by contrast, gives each index its own `Dep`. Maps are finer: `ObservableMap` keeps `data_: Map<K, ObservableValue>`, a `hasMap_` of per-key boolean observables, and a `keysAtom_`.

The public entry point for custom sources is the `Atom` pair:

```ts
public reportObserved(): boolean { return reportObserved(this) }

public reportChanged() {
	startBatch()
	propagateChanged(this)
	endBatch()
}
```

### Legend State — a Proxy that tracks nothing; only `.get()` tracks

Legend State's proxy `get` trap (`src/ObservableObject.ts`) returns _another proxy_ for property access and only records a dependency when an observable **function** is called. Property traversal is free and untracked:

```ts
// Return an observable proxy to the property
return getProxy(node, p);
```

`updateTracking` is called from exactly five places in the whole codebase:

```ts
export function get(node: NodeInfo, options?: TrackingType | GetOptions) {
	const track = options ? (isObject(options) ? (options.shallow as TrackingType) : options) : undefined;
	// Track by default
	updateTracking(node, track);
	return peek(node);
}
```

plus array loopers (`updateTracking(node, true)` before `map`/`filter`/…), `length` on an array, and `size` on a Map/Set (`handlerMapSet`). `peek()` is `peekInternal` without `updateTracking` — that is the entire untracked-read story.

Consequences worth stating plainly:

- `state$.user.profile.name` tracks **nothing**. `state$.user.profile.name.get()` tracks exactly the node for `name`.
- Granularity is the **node**, not the key-of-parent: `state$.user.get()` subscribes to the `user` node, and a change to `user.name` propagates up the node tree to it (§5).
- `get(true)` / `get({ shallow: true })` records `track: true` on the tracking entry, which becomes a shallow listener — it fires only for direct changes to that node, not for deep descendant changes.

The docs put the proxy-vs-tracking distinction this way: "Accessing properties through the observable will create a Proxy for every property accessed, but it will not do that while accessing the raw data", and "`peek()` returns the raw value in the same way as `get()`, but it does not automatically track it."

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/baseHandlers.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/arrayInstrumentations.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/collectionHandlers.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/types/observableobject.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/types/observablearray.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/types/dynamicobject.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/ObservableObject.ts>, <https://legendapp.com/open-source/state/v3/usage/observable/>

---

## 4. The dependency data structure and stale-dep pruning

### Vue — one `Link` per (dep, sub) pair, in two doubly-linked lists

```ts
/**
 * Represents a link between a source (Dep) and a subscriber (Effect or Computed).
 * Deps and subs have a many-to-many relationship - each link between a
 * dep and a sub is represented by a Link instance.
 *
 * A Link is also a node in two doubly-linked lists - one for the associated
 * sub to track all its deps, and one for the associated dep to track all its
 * subs.
 */
export class Link {
	version: number;
	nextDep?: Link;
	prevDep?: Link;
	nextSub?: Link;
	prevSub?: Link;
	prevActiveLink?: Link;
	constructor(
		public sub: Subscriber,
		public dep: Dep,
	) {
		this.version = dep.version;
	}
}
```

`Dep` carries a monotonic `version`, a pointer `activeLink` to the link for the currently-running sub, the `subs` tail pointer, a subscriber counter `sc`, and a back-reference to the `Map` it lives in so it can delete itself:

```ts
export class Dep {
	version = 0;
	activeLink?: Link = undefined;
	subs?: Link = undefined; // tail
	subsHead?: Link; // DEV only, head
	map?: KeyToDepMap = undefined;
	key?: unknown = undefined;
	sc: number = 0;
	constructor(public computed?: ComputedRefImpl | undefined) {}
}

export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap(); // target -> key -> Dep
```

Tracking is O(1) in the common case thanks to `activeLink`:

```ts
track(debugInfo?): Link | undefined {
	if (!activeSub || !shouldTrack || activeSub === this.computed) { return }
	let link = this.activeLink
	if (link === undefined || link.sub !== activeSub) {
		link = this.activeLink = new Link(activeSub, this)
		if (!activeSub.deps) {
			activeSub.deps = activeSub.depsTail = link
		} else {
			link.prevDep = activeSub.depsTail
			activeSub.depsTail!.nextDep = link
			activeSub.depsTail = link
		}
		addSub(link)
	} else if (link.version === -1) {
		// reused from last run - already a sub, just sync version
		link.version = this.version
		if (link.nextDep) { /* move to tail so dep order matches access order */ }
	}
	…
}
```

Pruning is the version −1 trick — mark all links stale before the run, resurrect the ones touched, sweep the rest from the tail:

```ts
function prepareDeps(sub: Subscriber) {
	for (let link = sub.deps; link; link = link.nextDep) {
		link.version = -1;
		link.prevActiveLink = link.dep.activeLink; // save, for nested runs on the same dep
		link.dep.activeLink = link;
	}
}

function cleanupDeps(sub: Subscriber) {
	let head;
	let tail = sub.depsTail;
	let link = tail;
	while (link) {
		const prev = link.prevDep;
		if (link.version === -1) {
			if (link === tail) tail = prev;
			removeSub(link);
			removeDep(link);
		} else {
			head = link;
		}
		link.dep.activeLink = link.prevActiveLink;
		link.prevActiveLink = undefined;
		link = prev;
	}
	sub.deps = head;
	sub.depsTail = tail;
}
```

No set allocation, no diffing pass, and surviving links are **recycled** rather than reallocated. `removeSub` also garbage-collects the `Dep` itself once nothing subscribes:

```ts
if (!soft && !--dep.sc && dep.map) {
	// #11979 property dep no longer has effect subscribers, delete it
	dep.map.delete(dep.key);
}
```

### MobX — array of deps, `Set` of observers, three-pass diff

```ts
export interface IDerivation extends IDepTreeNode {
	observing_: IObservable[];
	newObserving_: null | IObservable[];
	dependenciesState_: IDerivationState_;
	runId_: number;
	unboundDepsCount_: number;
	onBecomeStale_(): void;
}
```

The recording side is deliberately array-based (the comment in `core/observable.ts` is explicit that a `Set` was tried and lost):

```ts
export function reportObserved(observable: IObservable): boolean {
	checkIfStateReadsAreAllowed(observable);
	const derivation = globalState.trackingDerivation;
	if (derivation !== null) {
		/**
		 * Simple optimization, give each derivation run an unique id (runId)
		 * Check if last time this observable was accessed the same runId is used
		 * if this is the case, the relation is already known
		 */
		if (derivation.runId_ !== observable.lastAccessedBy_) {
			observable.lastAccessedBy_ = derivation.runId_;
			// Tried storing newObserving, or observing, or both as Set, but performance didn't come close...
			derivation.newObserving_![derivation.unboundDepsCount_++] = observable;
			if (!observable.isBeingObserved && globalState.trackingContext) {
				observable.isBeingObserved = true;
				observable.onBO();
			}
		}
		return observable.isBeingObserved;
	} else if (observable.observers_.size === 0 && globalState.inBatch > 0) {
		queueForUnobservation(observable);
	}
	return false;
}
```

`lastAccessedBy_ === runId_` is the same job Vue's `activeLink` does — suppress duplicate recording within one run — but it only dedupes _consecutive-ish_ repeats reliably; genuine duplicates are removed afterwards by `bindDependencies`, which does the whole reconciliation in three linear passes using a one-bit `diffValue` per observable:

```ts
function bindDependencies(derivation: IDerivation) {
	const prevObserving = derivation.observing_;
	const observing = (derivation.observing_ = derivation.newObserving_!);
	let lowestNewObservingDerivationState = IDerivationState_.UP_TO_DATE_;

	// Go through all new observables and check diffValue: (this list can contain duplicates):
	//   0: first occurrence, change to 1 and keep it
	//   1: extra occurrence, drop it
	let i0 = 0,
		l = derivation.unboundDepsCount_;
	for (let i = 0; i < l; i++) {
		const dep = observing[i];
		if (dep.diffValue === 0) {
			dep.diffValue = 1;
			if (i0 !== i) {
				observing[i0] = dep;
			}
			i0++;
		}
		if ((dep as any as IDerivation).dependenciesState_ > lowestNewObservingDerivationState) {
			lowestNewObservingDerivationState = (dep as any as IDerivation).dependenciesState_;
		}
	}
	observing.length = i0;
	derivation.newObserving_ = null;

	// old observables: 0 -> unobserve it; 1 -> still observed, reset to 0
	l = prevObserving.length;
	while (l--) {
		const dep = prevObserving[l];
		if (dep.diffValue === 0) {
			removeObserver(dep, derivation);
		}
		dep.diffValue = 0;
	}

	// new observables still at 1 -> newly observed, addObserver
	while (i0--) {
		const dep = observing[i0];
		if (dep.diffValue === 1) {
			dep.diffValue = 0;
			addObserver(dep, derivation);
		}
	}

	// Some new observed derivations may become stale during this derivation computation
	// so they have had no chance to propagate staleness (#916)
	if (lowestNewObservingDerivationState !== IDerivationState_.UP_TO_DATE_) {
		derivation.dependenciesState_ = lowestNewObservingDerivationState;
		derivation.onBecomeStale_();
	}
}
```

The reverse edge is a `Set`: `observable.observers_.add(node)` / `.delete(node)`, and dropping to zero observers queues the observable for unobservation (which is where computed suspension happens, §6). Diffing the two representations in 6.16.1 against 7.0.4 shows only allocation and build-flag changes — 7.0.4 allocates `observers_` lazily (`Set<IDerivation> | null`, "Allocated lazily on first observer to save memory"), replaces the `static readonly …Mask_` constants with `const enum` flags, drops `TraceMode`, and makes several `allowStateReads` guards `__DEV__`-only. `bindDependencies`, `reportObserved` and the propagation functions are unchanged.

Note the ordering guarantee MobX buys with the array: `observing_` is in **access order**, which `shouldCompute` relies on (§5).

### Legend State — no graph; a listener set per node, re-subscribed every run

The node tree is created lazily as proxies are traversed (`src/globals.ts`):

```ts
export function getChildNode(node: NodeInfo, key: string, asFunction?: Function): NodeInfo {
	let child = node.children?.get(key);
	if (!child) {
		child = { root: node.root, parent: node, key, lazy: true, numListenersRecursive: 0 };
		…
		node.children.set(key, child);
	}
	return child;
}
```

and a node's subscribers are just callbacks:

```ts
interface BaseNodeInfo {
	children?: Map<string, ChildNodeInfo>;
	root: ObservableRoot;
	listeners?: Set<NodeListener>;
	listenersImmediate?: Set<NodeListener>;
	numListenersRecursive: number;
	parent?: NodeInfo;
	key?: string;
	dirtyFn?: () => void;
	dirtyChildren?: Set<NodeInfo>;
	…
}
```

The read set becomes subscriptions in `src/setupTracking.ts`:

```ts
export function setupTracking(nodes, update, noArgs?, immediate?) {
	let listeners: (() => void)[] | undefined = [];
	nodes?.forEach((tracked) => {
		const { node, track } = tracked;
		listeners!.push(onChange(node, update, { trackingType: track, immediate, noArgs }));
	});
	return () => {
		if (listeners) {
			for (let i = 0; i < listeners.length; i++) {
				listeners[i]();
			}
			listeners = undefined;
		}
	};
}
```

**There is no pruning, because there is no persistent dep list.** Every re-run calls `dispose?.()` (unsubscribing every listener) and then `setupTracking` again from scratch — see `observe()` in §5 and `useSelector`'s `run()`. The cost per run is O(deps) unsubscribes + O(deps) `Set.add` + a walk up the parent chain per subscription (`node.numListenersRecursive++` for every ancestor), versus Vue's O(deps) pointer writes with zero allocation for unchanged deps.

`numListenersRecursive` on each ancestor is the one piece of derived bookkeeping: it lets change propagation skip entire subtrees that nobody is watching (§5).

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/dep.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/derivation.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/observable.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/setupTracking.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/observableInterfaces.ts>

---

## 5. Invalidation and scheduling

### Vue — push a notification, pull the truth

A write bumps two counters and pushes a notification down the sub list:

```ts
trigger(debugInfo?): void {
	this.version++
	globalVersion++
	this.notify(debugInfo)
}

notify(debugInfo?): void {
	startBatch()
	try {
		for (let link = this.subs; link; link = link.prevSub) {
			if (link.sub.notify()) {
				// if notify() returns `true`, this is a computed. Also call notify
				// on its dep - it's called here instead of inside computed's notify
				// in order to reduce call stack depth.
				;(link.sub as ComputedRefImpl).dep.notify()
			}
		}
	} finally {
		endBatch()
	}
}
```

Notification does not run anything; it only queues, using `NOTIFIED` as an idempotence flag and two intrusive singly-linked queues (`next` pointer on the subscriber):

```ts
export function batch(sub: Subscriber, isComputed = false): void {
	sub.flags |= EffectFlags.NOTIFIED;
	if (isComputed) {
		sub.next = batchedComputed;
		batchedComputed = sub;
		return;
	}
	sub.next = batchedSub;
	batchedSub = sub;
}
```

`endBatch()` first clears `NOTIFIED` on all batched computeds (they are never "run", only un-flagged), then drains the effect queue calling `trigger()` on each, collecting the first error and rethrowing at the end. `trigger()` → `runIfDirty()` → `isDirty()`:

```ts
function isDirty(sub: Subscriber): boolean {
	for (let link = sub.deps; link; link = link.nextDep) {
		if (
			link.dep.version !== link.version ||
			(link.dep.computed &&
				(refreshComputed(link.dep.computed) || link.dep.version !== link.version))
		) {
			return true
		}
	}
	…
	return false
}
```

This is the push-pull split: the push phase is O(subscribers) flag setting; the _decision_ to re-run is a pull that compares each link's captured `version` with the dep's current `version`, refreshing computeds on demand. It is glitch-free by construction — an effect is queued at most once per batch (`NOTIFIED`), and when it finally runs it reads whatever the current values are, so a diamond (`a` → `b`, `a` → `c`, `b`+`c` → effect) produces exactly one effect run with consistent values.

`trigger()` in `dep.ts` decides which deps to notify for a mutation, and this is where array/collection semantics live:

```ts
if (targetIsArray && key === 'length') {
	const newLength = Number(newValue)
	depsMap.forEach((dep, key) => {
		if (key === 'length' || key === ARRAY_ITERATE_KEY || (!isSymbol(key) && key >= newLength)) {
			run(dep)
		}
	})
} else {
	if (key !== void 0 || depsMap.has(void 0)) { run(depsMap.get(key)) }
	if (isArrayIndex) { run(depsMap.get(ARRAY_ITERATE_KEY)) }
	switch (type) {
		case TriggerOpTypes.ADD:
			if (!targetIsArray) {
				run(depsMap.get(ITERATE_KEY))
				if (isMap(target)) { run(depsMap.get(MAP_KEY_ITERATE_KEY)) }
			} else if (isArrayIndex) {
				run(depsMap.get('length'))   // new index added to array -> length changes
			}
			break
		…
	}
}
```

Also note the miss path: `if (!depsMap) { globalVersion++; return }` — even an untracked object's mutation bumps the global version, which is what keeps the computed fast path (§6) honest.

### MobX — three-state staleness, pure push of _staleness_, pull of values

`IDerivationState_` is the whole scheduling model:

```ts
export enum IDerivationState_ {
	NOT_TRACKING_ = -1, // before being run or (outside batch and not being observed)
	UP_TO_DATE_ = 0, // no shallow dependency changed since last computation
	POSSIBLY_STALE_ = 1, // some deep dependency changed, but don't know if shallow dependency changed
	STALE_ = 2, // a shallow dependency has changed since last computation
}
```

Three propagation functions in `core/observable.ts`, each guarded by the observable's `lowestObserverState_` so a repeated write in the same batch costs nothing:

- `propagateChanged` — an `Atom`/`ObservableValue` changed: observers go to `STALE_` and get `onBecomeStale_()`.
- `propagateMaybeChanged` — a `ComputedValue`'s dep changed: observers that were `UP_TO_DATE_` go to `POSSIBLY_STALE_`. This is what prevents eager recomputation of a computed chain.
- `propagateChangeConfirmed` — a `ComputedValue` recomputed and actually changed: `POSSIBLY_STALE_` observers are promoted to `STALE_`.

The pull side is `shouldCompute`, and its comment states the glitch-freedom argument directly:

```ts
/**
 * By iterating over the dependencies in the same order that they were reported and
 * stopping on the first change, all the recalculations are only called for ComputedValues
 * that will be tracked by derivation. …
 */
export function shouldCompute(derivation: IDerivation): boolean {
	switch (derivation.dependenciesState_) {
		case IDerivationState_.UP_TO_DATE_:
			return false;
		case IDerivationState_.NOT_TRACKING_:
		case IDerivationState_.STALE_:
			return true;
		case IDerivationState_.POSSIBLY_STALE_: {
			const prevUntracked = untrackedStart();
			const obs = derivation.observing_,
				l = obs.length;
			for (let i = 0; i < l; i++) {
				const obj = obs[i];
				if (isComputedValue(obj)) {
					obj.get(); // may promote us to STALE_ via propagateChangeConfirmed
					if ((derivation.dependenciesState_ as any) === IDerivationState_.STALE_) {
						untrackedEnd(prevUntracked);
						return true;
					}
				}
			}
			changeDependenciesStateTo0(derivation);
			untrackedEnd(prevUntracked);
			return false;
		}
	}
}
```

Scheduling of reactions is a trampoline over a pending queue:

```ts
export function runReactions() {
	// Trampolining, if runReactions are already running, new reactions will be picked up
	if (globalState.inBatch > 0 || globalState.isRunningReactions) {
		return;
	}
	reactionScheduler(runReactionsHelper);
}
```

with a convergence guard (`MAX_REACTION_ITERATIONS = 100`, after which it logs "Reaction doesn't converge to a stable state" and clears the queue).

Batching is `globalState.inBatch`, and the only thing that flushes it is `endBatch`:

```ts
export function endBatch() {
	if (--globalState.inBatch === 0) {
		runReactions();
		// the batch is actually about to finish, all unobserving should happen here.
		const list = globalState.pendingUnobservations;
		for (let i = 0; i < list.length; i++) {
			const observable = list[i];
			observable.isPendingUnobservation = false;
			if (observable.observers_.size === 0) {
				if (observable.isBeingObserved) {
					observable.isBeingObserved = false;
					observable.onBUO();
				}
				if (observable instanceof ComputedValue) {
					observable.suspend_();
				}
			}
		}
		globalState.pendingUnobservations = [];
	}
}
```

Actions are exactly "untracked + batch" (`core/action.ts`):

```ts
const prevDerivation_ = globalState.trackingDerivation;
const runAsAction = !canRunAsDerivation || !prevDerivation_;
startBatch();
if (runAsAction) {
	untrackedStart();
	prevAllowStateChanges_ = allowStateChangesStart(true);
}
```

which is the implementation of the documented guarantee: "They are run inside transactions. No reactions will be run until the outer-most action has finished".

### Legend State — pure push, over the node tree, with no dirty bits for plain state

A `set` calls `notify(node, value, prev, level)` in `src/batching.ts`, which walks **up the parent chain** collecting one change record per node that has listeners:

```ts
function computeChangesRecursive(changesInBatch, node, loading, remote, value, path, pathTypes, valueAtPath, prevAtPath, immediate, level, whenOptimizedOnlyIf?) {
	if (node.numListenersRecursive > 0) {
		computeChangesAtNode(changesInBatch, node, …);
		…
	}
	// If not root notify up through parents
	if (node.parent) {
		const parent = node.parent;
		computeChangesRecursive(changesInBatch, parent, …, [node.key].concat(path), …, level + 1, …);
	}
}
```

`level` is the depth of the change relative to the listening node, and it is what implements shallow listeners:

```ts
const ok = track === true ? level <= 0 : track === optimized ? whenOptimizedOnlyIf && level <= 0 : true;
```

so `get()` (track `undefined`) fires for any descendant change, `get(true)` only for direct ones.

Batching is a counter plus a `Map<NodeInfo, BatchItem>`:

```ts
export function beginBatch() {
	numInBatch++;
	if (!timeout) { timeout = setTimeout(onActionTimeout, 0); }
}
export function endBatch(force?: boolean) {
	numInBatch--;
	if (numInBatch <= 0 || force) {
		if (isRunningBatch) { didDelayEndBatch = true; }
		else { … isRunningBatch = true; runBatch(); isRunningBatch = false; if (didDelayEndBatch) { didDelayEndBatch = false; endBatch(true) } }
	}
}
```

and outside a batch `notify` flushes immediately (`if (numInBatch <= 0) { runBatch(); }`). Within one flush a listener is called at most once — but only for non-shallow listeners:

```ts
if (!track) {
	listenersNotified.add(listener);
}
listener(listenerParams!);
```

`_batchMap` also cancels no-op changes: if a value was set and then reverted inside the batch (`existing.prev === value`) the entry is deleted.

**There is no glitch-freedom machinery.** Nothing in Legend State compares versions or defers a run until all upstreams settle; the only de-duplication is (a) the per-batch `listenersNotified` set and (b) the consumer re-checking the value — `useSelector._update` re-runs the selector and compares `newValue !== prev` before bumping its version. Diamonds are handled by "run it and see if the answer changed", not by graph ordering.

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/dep.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/observable.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/reaction.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/action.ts>, <https://mobx.js.org/actions.html>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts>

---

## 6. Computed / derived values

### Vue — a `Subscriber` that owns a `Dep`, with a global-version fast path

```ts
export class ComputedRefImpl<T = any> implements Subscriber {
	_value: any = undefined
	readonly dep: Dep = new Dep(this)
	deps?: Link = undefined
	depsTail?: Link = undefined
	flags: EffectFlags = EffectFlags.DIRTY
	globalVersion: number = globalVersion - 1
	…
	notify(): true | void {
		this.flags |= EffectFlags.DIRTY
		if (!(this.flags & EffectFlags.NOTIFIED) && activeSub !== this) {
			batch(this, true)
			return true      // tells Dep.notify to also notify our own dep
		}
	}

	get value(): T {
		const link = __DEV__ ? this.dep.track({…}) : this.dep.track()
		refreshComputed(this)
		if (link) { link.version = this.dep.version }   // sync version after evaluation
		return this._value
	}
}
```

`refreshComputed` contains all four caching rules:

```ts
export function refreshComputed(computed: ComputedRefImpl): undefined {
	// 1. subscribed and not dirty -> nothing to do
	if (computed.flags & EffectFlags.TRACKING && !(computed.flags & EffectFlags.DIRTY)) {
		return;
	}
	computed.flags &= ~EffectFlags.DIRTY;

	// 2. Global version fast path when no reactive changes has happened since last refresh.
	if (computed.globalVersion === globalVersion) {
		return;
	}
	computed.globalVersion = globalVersion;

	// 3. evaluated and deps unchanged -> keep cache (also the SSR/no-subscriber path)
	if (
		!computed.isSSR &&
		computed.flags & EffectFlags.EVALUATED &&
		((!computed.deps && !(computed as any)._dirty) || !isDirty(computed))
	) {
		return;
	}

	computed.flags |= EffectFlags.RUNNING;
	const dep = computed.dep;
	const prevSub = activeSub;
	const prevShouldTrack = shouldTrack;
	activeSub = computed;
	shouldTrack = true;
	try {
		prepareDeps(computed);
		const value = computed.fn(computed._value);
		// 4. equality cutoff: only bump dep.version if the value actually changed
		if (dep.version === 0 || hasChanged(value, computed._value)) {
			computed.flags |= EffectFlags.EVALUATED;
			computed._value = value;
			dep.version++;
		}
	} catch (err) {
		dep.version++;
		throw err;
	} finally {
		activeSub = prevSub;
		shouldTrack = prevShouldTrack;
		cleanupDeps(computed);
		computed.flags &= ~EffectFlags.RUNNING;
	}
}
```

Rule 4 is the cutoff that makes downstream effects skip: they compare `link.version` against `dep.version`, which never moved.

Lazy subscription/unsubscription is in `dep.ts`/`effect.ts`. A computed only subscribes to its own deps once **it** gets a subscriber:

```ts
function addSub(link: Link) {
	link.dep.sc++
	if (link.sub.flags & EffectFlags.TRACKING) {
		const computed = link.dep.computed
		// computed getting its first subscriber
		// enable tracking + lazily subscribe to all its deps
		if (computed && !link.dep.subs) {
			computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY
			for (let l = computed.deps; l; l = l.nextDep) { addSub(l) }
		}
		…
	}
}
```

and unsubscribes ("soft", keeping the dep list for reuse) when the last one leaves:

```ts
if (dep.subs === link) {
	dep.subs = prevSub;
	if (!prevSub && dep.computed) {
		// if computed, unsubscribe it from all its deps so this computed and its
		// value can be GCed
		dep.computed.flags &= ~EffectFlags.TRACKING;
		for (let l = dep.computed.deps; l; l = l.nextDep) {
			removeSub(l, true);
		}
	}
}
```

An unobserved Vue computed therefore still caches (via `globalVersion` and `isDirty`); it just stops holding subscriptions.

### MobX — a computed is both observable and derivation, and is _destroyed_ when unobserved

`ComputedValue` implements `IObservable`, `IComputedValue<T>` and `IDerivation` simultaneously. `get()` has two distinct modes:

```ts
public get(): T {
	if (this.isComputing) { die(32, this.name_, this.derivation) }
	if (globalState.inBatch === 0 && this.observers_.size === 0 && !this.keepAlive_) {
		if (shouldCompute(this)) {
			this.warnAboutUntrackedRead_()
			startBatch()   // See perf test 'computed memoization'
			this.value_ = this.computeValue_(false)   // <- track: false, no dep recording
			endBatch()
		}
	} else {
		reportObserved(this)
		if (shouldCompute(this)) {
			let prevTrackingContext = globalState.trackingContext
			if (this.keepAlive_ && !prevTrackingContext) { globalState.trackingContext = this }
			if (this.trackAndCompute()) { propagateChangeConfirmed(this) }
			globalState.trackingContext = prevTrackingContext
		}
		…
	}
}
```

The first branch is the documented behaviour that "if a computed property is not in use by some reaction, then computed expressions are evaluated each time their value is requested, so they behave just like a normal property" — with `track: false`, the derivation records nothing and `dependenciesState_` stays `NOT_TRACKING_`, so `shouldCompute` returns `true` every time.

Suspension happens in `endBatch` (§5) via:

```ts
suspend_() {
	if (!this.keepAlive_) {
		clearObserving(this)
		this.value_ = undefined // don't hold on to computed value!
		…
	}
}
```

and the equality cutoff is `trackAndCompute`, using the configurable `equals_` comparer (`comparer.default` identity, or `comparer.structural`):

```ts
trackAndCompute(): boolean {
	const oldValue = this.value_
	const wasSuspended = /* see #1208 */ this.dependenciesState_ === IDerivationState_.NOT_TRACKING_
	const newValue = this.computeValue_(true)
	const changed = wasSuspended || isCaughtException(oldValue) || isCaughtException(newValue) ||
		!this.equals_(oldValue, newValue)
	if (changed) { this.value_ = newValue }
	return changed
}
```

`computeValue_` wraps the evaluation in `allowStateChangesStart(false)`, which is how "computed values should not have side effects" is enforced (as a dev warning).

### Legend State — a computed _is_ an observable node with a lazy activation function

`src/computed.ts` is a thin wrapper:

```ts
export function computed<T, T2 = T>(get, set?): Observable<T> {
	return observable(
		set ? linked({ get: get as LinkedOptions["get"], set: ({ value }: any) => set(value) }) : get,
	) as any;
}
```

The machinery is `activateNodeFunction` in `ObservableObject.ts`, which runs the function inside `observe(..., { fromComputed: true })` and **pushes** the result into the node:

```ts
node.isComputing = true;
set(node, value);
node.isComputing = false;
…
disposes.forEach((fn) => fn());
disposes = [];
nodes?.forEach(({ node, track }) => {
	disposes.push(onChange(node, markDirty, { immediate: true, trackingType: track }));
});
```

So a Legend computed is eagerly evaluated and its value is _stored_ in the tree — downstream consumers read it like any other node, and a computed of a computed is just a node reading another node. The laziness is a separate mechanism keyed off whether anyone is listening:

```ts
export function shouldIgnoreUnobserved(node: NodeInfo, refreshFn: () => void) {
	if (!isFlushing) {
		const hasListeners = isObserved(node);
		if (!hasListeners) {
			if (refreshFn) {
				node.dirtyFn = refreshFn;
			}
			let parent = node;
			while (parent) {
				if (!parent.dirtyChildren) {
					parent.dirtyChildren = new Set();
				}
				parent.dirtyChildren.add(node);
				parent = parent.parent!;
			}
			return true;
		}
	}
}
```

An unobserved computed's dependency change does not recompute; it records `dirtyFn` on the node and registers the node in every ancestor's `dirtyChildren`. The recompute is pulled on the next read, in `peekInternal`:

```ts
export function peekInternal(node: NodeInfo, activateRecursive?: boolean) {
	isFlushing = true;
	if (activateRecursive && node.dirtyChildren?.size) {
		const dirty = Array.from(node.dirtyChildren);
		node.dirtyChildren.clear();
		dirty.forEach((node) => node.dirtyFn && peekInternal(node));
	}
	if (node.dirtyFn) {
		const dirtyFn = node.dirtyFn;
		node.dirtyFn = undefined;
		globalState.dirtyNodes.delete(node);
		dirtyFn();
	}
	isFlushing = false;
	…
}
```

`runBatch` also flushes `globalState.dirtyNodes` at the start of each batch. "Lookup observables" (a computed keyed by a string) fall out of the same design — `getChildNode` binds the parent's `lazyFn` to the child key when `node.lazyFn?.length === 1`, so `lookup$[key].get()` activates a per-key computed node.

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/computed.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/computedvalue.ts>, <https://mobx.js.org/computeds.html>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/ObservableObject.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/computed.ts>

---

## 7. Escape hatches and known limits

### Escape hatches, by library

| Need                       | Vue                                                                                      | MobX                                                                                              | Legend State                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Read without tracking      | `pauseTracking()` / `resetTracking()`; `toRaw(obj)`                                      | `untracked(fn)`, `untrackedStart/End`; any code inside an `action` (which calls `untrackedStart`) | `peek()` (or `$` getters that call peek); **no `untracked` export exists** |
| Opt an object out entirely | `markRaw(value)` — sets `__v_skip`                                                       | `observable.ref` / `observable.shallow` annotations; non-annotated fields                         | `ObservableHint.opaque` / `ObservableHint.plain`                           |
| Batch writes               | `startBatch()` / `endBatch()` (internal); component updates are batched by the scheduler | `action`, `runInAction`, `transaction`                                                            | `batch(fn)`, `beginBatch()` / `endBatch()`                                 |
| Shallow reactivity         | `shallowRef`, `shallowReactive`, `shallowReadonly`                                       | `observable.shallow`                                                                              | `get(true)` / `get({ shallow: true })`, `optimized`                        |

### What cannot be tracked

**All three lose tracking across `await`.** The mechanism is identical in each: the "current observer" global is restored in a `finally` that runs at the first suspension point, so everything after an `await` executes with no tracking context. Vue restores `activeSub = prevEffect`; MobX restores `globalState.trackingDerivation = prevTracking` right after `f.call(context)` returns (a promise); Legend State calls `endTracking()` immediately after the selector returns. MobX's docs say it outright: "MobX does not track asynchronously accessed data."

**Destructuring and copying out values** breaks tracking in Vue (`const { count } = reactive(obj)` yields a plain number) and in MobX ("Extracting properties like `const {name} = user` outside a tracked function captures only the value"). In Legend State it is the _default_ state of affairs — property access alone never tracks, so the failure mode is inverted: you must remember to call `.get()`, and the type system is what reminds you.

**Raw values escape.** `toRaw()` in Vue, `toJS()` in MobX and `peek()` in Legend State all hand back objects whose reads are invisible to the tracker. Vue additionally skips tracking for `__proto__`, `__v_isRef`, `__isVue` and all built-in symbol keys.

**Array indices vs length.** Vue: reading `arr[5]` when `arr.length === 2` creates a dep for key `"5"`, and a later `arr.push` triggers it via the `ADD` → `length` path, so out-of-bounds reads _do_ become reactive. MobX: the array has one atom, so index granularity does not exist at all, but in `legacyMode_` an out-of-bounds read warns "Attempt to read an array index … that is out of bounds … Out of bound indices will not be tracked by MobX", and the docs advise guarding index access with `.length`. Legend State: array element access goes through child nodes keyed by index string, and `length` is tracked explicitly (`updateTracking(node, true)` for `p === 'length'`).

**`in` / key enumeration.** Vue tracks `has` per key and `ownKeys` on `ITERATE_KEY`. MobX tracks `in` per key only inside a derivation, and `ownKeys` on a single `keysAtom_`; without the Proxy (plain `makeObservable` classes) `in` and key iteration are not reactive at all and dev builds warn ("detect new properties using the 'in' operator. Use 'has' from 'mobx' instead."). Legend State has an `ownKeys` trap but it does not call `updateTracking` — key enumeration is not a tracked operation.

**Self-invalidation.** Vue guards with `activeSub === this.computed` in `Dep.track` and `activeSub !== this` in `ComputedRefImpl.notify`, plus the `RUNNING`/`ALLOW_RECURSE` check in `ReactiveEffect.notify`. MobX guards computed cycles with `isComputing` (`die(32)`) and reaction cycles with `MAX_REACTION_ITERATIONS`. Legend State's `observe()` uses a plain `isRunning` boolean: "Prevent observe from triggering itself when it activates a node".

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/reactive.ts>, <https://mobx.js.org/understanding-reactivity.html>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/types/observablearray.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/observe.ts>, <https://legendapp.com/open-source/state/v3/usage/observable/>

---

## 8. Framework integration

### Vue — the component render function _is_ the effect

`packages/runtime-core/src/renderer.ts`:

```ts
// create reactive effect for rendering
instance.scope.on();
const effect = (instance.effect = new ReactiveEffect(componentUpdateFn));
instance.scope.off();

const update = (instance.update = effect.run.bind(effect));
const job: SchedulerJob = (instance.job = effect.runIfDirty.bind(effect));
job.i = instance;
job.id = instance.uid;
effect.scheduler = () => queueJob(job);
```

So a component subscribes by rendering: every reactive read during `componentUpdateFn` links the render effect to that key's `Dep`. Invalidation sets `NOTIFIED`, `endBatch` calls `trigger()`, the scheduler queues `runIfDirty`, and the dirty check (`isDirty`) runs at flush time — a write that is later reverted in the same tick produces no re-render. The effect is owned by the component's `EffectScope`, which stops it on unmount.

### MobX — `observer` is a `Reaction` + `useSyncExternalStore`

`mobx-react-lite` 5.0.3, `src/useObserver.ts`:

```ts
function createReaction(adm: ObserverAdministration) {
	adm.reaction = new Reaction(`observer${adm.name}`, () => {
		adm.stateVersion = Symbol()
		adm.onStoreChange?.()
	})
}
…
React.useSyncExternalStore(adm.subscribe, adm.getSnapshot, adm.getSnapshot)

adm.reaction!.track(() => {
	try { renderResult = render() } catch (e) { exception = e }
})
```

`getSnapshot` returns `adm.stateVersion`, a `Symbol()` that is replaced whenever the reaction fires — the "store" React subscribes to is a version token, not the data. Render happens inside `reaction.track()`, so the dependency set is rebuilt every render by `bindDependencies`. A `FinalizationRegistry` disposes reactions from renders that React abandoned (StrictMode / Suspense). The file's comments note the tearing caveat: "tearing is still present, because there is no cross component synchronization".

### Legend State — `useValue`/`use$` per selector, `observer` per component, `Memo` per subtree

`useSelector` (exported as both `use$` and `useValue`) subscribes during **render**, not in an effect:

```ts
const run = () => {
	dispose?.();
	const { value, dispose: _dispose, resubscribe: _resubscribe } =
		trackSelector(_selector, _update, options, undefined, undefined, /*createResubscribe*/ true);
	dispose = _dispose; resubscribe = _resubscribe;
	return value;
};
…
value = runInRender(() => run(selector) as any);
useSyncExternalStore(subscribe, getVersion, getVersion);
```

`trackSelector`'s comment explains why: "useSyncExternalStore doesn't subscribe until after the component mount. We want to subscribe immediately so we don't miss any updates." The update path re-runs the selector and only bumps `version` if the computed value actually differs (`newValue !== prev`), so `useSyncExternalStore`'s `getSnapshot` stays stable for irrelevant changes. Notifications that arrive mid-render are deferred to a microtask (`reactGlobals.renderDepth > 0`).

`observer(Component)` sets `reactGlobals.inObserver`, which lets `useSelector` short-circuit when the selector is an observable, collapsing many reads into one hook — the docs describe it as tracking "all overable access with a single hook so it is much more efficient than using multiple hooks."

`Memo` is the fine-grained escape from the component tree entirely:

```tsx
export function Computed({ children }): ReactElement {
	return useSelector(() => computeSelector(computeSelector(children)), { skipCheck: true }) as ReactElement;
}

export const Memo = memo(Computed as ComputedWithMemo, (prev, next) =>
	next.scoped ? prev.children === next.children : true,
);
```

The `memo` comparator returns `true` unconditionally (unless `scoped`), i.e. "never re-render from the parent" — the docs: "Memo is similar to Computed, but it will never re-render when the parent component renders - only if its own observables change."

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/runtime-core/src/renderer.ts>, <https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/useObserver.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/useSelector.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/react/Memo.tsx>, <https://legendapp.com/open-source/state/v3/react/fine-grained-reactivity/>, <https://legendapp.com/open-source/state/v3/react/react-api/>

---

## 9. Comparison

|                          | **Vue 3.5**                                                                                                                                   | **MobX 6**                                                                                                                                           | **Legend State 3**                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Interception             | `Proxy` traps (`get`/`set`/`has`/`ownKeys`/`deleteProperty`) + instrumented array & collection methods; `ref`/`computed` own their `Dep`      | ES getter/setter per property on the target, installed by annotations; optional `Proxy` only for `has`/`ownKeys`/add/delete                          | `Proxy` that returns child proxies and tracks **nothing**; tracking happens only in the explicit `.get()` accessor             |
| Granularity              | per object key; `ITERATE_KEY` for enumeration; `ARRAY_ITERATE_KEY` for array iteration; per-index for direct index reads; per-key for Map/Set | per property; per Map key; one `keysAtom_` per object; **one atom for an entire array**                                                              | per node in a tree mirroring the data; child changes propagate up to ancestor listeners; `shallow`/`optimized` levels          |
| Tracking context         | `activeSub` + `shouldTrack` boolean stack                                                                                                     | `globalState.trackingDerivation` (record?) + `trackingContext` (reactive?)                                                                           | `tracking.current`, a `Map<NodeInfo, TrackingNode>` valid for one run, on an explicit stack                                    |
| Dep storage              | one `Link` per (dep, sub), node in two doubly-linked lists; `WeakMap<target, Map<key, Dep>>`                                                  | `observing_: IObservable[]` (access-ordered) + `observers_: Set<IDerivation>`                                                                        | `node.listeners: Set<NodeListener>` — plain callbacks, no back-reference to a subscriber object                                |
| Stale-dep pruning        | mark `version = -1`, resurrect on access, sweep from tail; links recycled, no allocation for unchanged deps                                   | `bindDependencies` three-pass diff on a one-bit `diffValue`, allocating a fresh `newObserving_` array per run                                        | none — dispose every listener and re-subscribe from scratch each run                                                           |
| Invalidation             | push a `NOTIFIED` flag; pull via `isDirty` comparing `link.version` to `dep.version`, plus a `globalVersion` fast path                        | push staleness through three states (`STALE_`/`POSSIBLY_STALE_`/`UP_TO_DATE_`); pull via `shouldCompute` walking deps in access order                | pure push: walk the node's ancestors, call every listener; consumers diff values themselves                                    |
| Glitch freedom           | yes — one queued run per effect per batch, values pulled at run time                                                                          | yes — `POSSIBLY_STALE_` + ordered `shouldCompute` means a diamond recomputes once, in order                                                          | no graph-level guarantee; per-batch listener dedupe + value comparison in `useSelector`                                        |
| Batching                 | `startBatch`/`endBatch` depth counter; two intrusive queues (computeds, effects); component updates additionally queued by the scheduler      | `globalState.inBatch`; `endBatch` runs reactions (trampolined, max 100 iterations) then drains `pendingUnobservations`; `action` = untracked + batch | `numInBatch` + `_batchMap`; outside a batch every `set` flushes immediately; a watchdog `setTimeout` force-ends a leaked batch |
| Computed when unobserved | still cached (`globalVersion` / `isDirty`); soft-unsubscribes from its deps so it can be GC'd                                                 | **suspended**: `clearObserving`, `value_ = undefined`, and every read recomputes untracked unless `keepAlive`                                        | not recomputed on change; marks `dirtyFn` + ancestors' `dirtyChildren`, recomputes on next read                                |
| Equality cutoff          | `hasChanged(value, _value)` gates `dep.version++`                                                                                             | configurable `equals_` (`comparer.default` / `structural`) gates `propagateChangeConfirmed`                                                          | none in the core; `useSelector` compares selector output per render                                                            |

### Where each design wins, and what it pays

**Vue is the cheapest steady-state tracker.** After the first run of an effect, re-tracking the same deps allocates nothing: `Dep.activeLink` makes the lookup O(1), and `prepareDeps`/`cleanupDeps` only flip integers and pointers. Combined with per-key deps and `globalVersion` short-circuiting, a component that reads 50 properties and re-renders costs 50 version writes. The price is complexity (a `Link` object per edge, five pointer fields, two intrusive list invariants to maintain across `removeSub`/`removeDep`/`cleanupDeps`) and a hard dependency on `Proxy` semantics, which forces a long tail of special cases — `arrayInstrumentations.ts` is 382 lines of them, and `toRaw`/`markRaw` exist because proxy identity leaks.

**MobX is the most precise about _when_ work happens.** `POSSIBLY_STALE_` plus access-ordered `observing_` means a chain of computeds recomputes strictly in dependency order and stops at the first unchanged link, and the `equals_` hook lets you cut a propagation off structurally. Suspension of unobserved computeds is stricter memory hygiene than Vue's. The prices: per-run array allocation and a three-pass diff (Vue does neither), and **array granularity is a whole atom** — a list of 10 000 rows where one row changes invalidates every reader of the list, whereas Vue invalidates only the readers of that index. MobX also makes the reactive/non-reactive boundary a configuration question (annotations, `enforceActions`, proxy vs non-proxy objects) rather than a syntactic one.

**Legend State is the cheapest _read_, and the most expensive _subscribe_.** Because traversal does not track, walking `state$.a.b.c` costs proxy hops and no bookkeeping, and the node tree doubles as the change-propagation path, so nothing like `targetMap` or `observing_` has to be maintained. In exchange it gives up the dependency graph entirely: every re-run tears down and rebuilds every subscription (each one walking the ancestor chain to update `numListenersRecursive`), there is no version/dirty protocol for plain observables, and correctness under diamonds relies on the consumer re-running the selector and comparing. Its answer to the resulting re-render pressure is not a smarter graph but a smaller unit of work — `Memo`, `Computed`, `Show` and `reactive` props push the observing context down to a single DOM node, which is the design the docs describe as "observe state changing rather than observing renders".

**One axis they genuinely disagree on** is what an unobserved computed means: Vue keeps the cache and drops the subscriptions; MobX drops both and degrades to a plain getter; Legend State keeps the stored value but defers recomputation until someone reads. A port between them will produce different numbers of evaluations for the same code, and MobX's is the one that can silently become O(n) recomputations if a computed is read in a loop outside any reaction.

Sources: <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/dep.ts>, <https://github.com/vuejs/core/blob/v3.5.43/packages/reactivity/src/effect.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/derivation.ts>, <https://github.com/mobxjs/mobx/blob/mobx%406.16.1/packages/mobx/src/core/computedvalue.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/setupTracking.ts>, <https://github.com/LegendApp/legend-state/blob/23b5ddeb87598082987aa475dee1586d54328034/src/batching.ts>, <https://legendapp.com/open-source/state/v3/react/fine-grained-reactivity/>

---

## Source list

- Vue reactivity source, tag `v3.5.43` (commit `5be58b4`) — <https://github.com/vuejs/core/tree/v3.5.43/packages/reactivity/src>
- Vue PR #10397, version counting + doubly-linked list — <https://github.com/vuejs/core/pull/10397>
- Vue PR #12349, `alien-signals` 0.4.4 port — <https://github.com/vuejs/core/pull/12349>
- Vue 3.5 release post — <https://blog.vuejs.org/posts/vue-3-5>
- Vue reactivity in depth (simplified pseudo-code, not the shipped implementation) — <https://vuejs.org/guide/extras/reactivity-in-depth.html>
- MobX source, tag `mobx@6.16.1` — <https://github.com/mobxjs/mobx/tree/mobx%406.16.1/packages/mobx/src>
- MobX understanding reactivity — <https://mobx.js.org/understanding-reactivity.html>
- MobX computeds — <https://mobx.js.org/computeds.html>
- MobX actions — <https://mobx.js.org/actions.html>
- mobx-react-lite 5.0.3 `useObserver` — <https://github.com/mobxjs/mobx/blob/main/packages/mobx-react-lite/src/useObserver.ts>
- Legend State source, commit `23b5ddeb` (version 3.0.0-beta.48) — <https://github.com/LegendApp/legend-state/tree/23b5ddeb87598082987aa475dee1586d54328034/src>
- Legend State observable docs — <https://legendapp.com/open-source/state/v3/usage/observable/>
- Legend State fine-grained reactivity — <https://legendapp.com/open-source/state/v3/react/fine-grained-reactivity/>
- Legend State React API — <https://legendapp.com/open-source/state/v3/react/react-api/>
