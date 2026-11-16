# How `React.lazy` handles lazy imports

`React.lazy` turns a function that returns a promise into something React can render as a component type or as a child node. This note follows the whole path: the public contract on react.dev, the small state machine in `ReactLazy.js` that caches the load, how the Fiber reconciler turns a pending load into a Suspense fallback and a later retry, what happens when the load rejects, and how the server renderers (Fizz) and React Server Components (Flight) use the same lazy object. It ends with what this means for library authors.

Researched **2026-11-11** against `facebook/react` `main` at commit **`1620f7b943eb5de6a055e8eb042ad6e36b5317d4`** (committed 2026-11-11, `packages/react/package.json` version `19.3.0`), read from a shallow clone. No code from the clone was run. Every `file:line` below refers to that commit. Docs are the moving `react.dev` pages, read on the same day.

## Sources

- React docs: [`lazy`][doc-lazy], [`<Suspense>`][doc-suspense], [`use`][doc-use], [error boundaries in `Component`][doc-eb]
- `facebook/react@1620f7b9`:
  - [`packages/react/src/ReactLazy.js`][lazy]: `lazy`, `lazyInitializer`, payload states
  - [`packages/shared/ReactSymbols.js`][symbols]: `REACT_LAZY_TYPE`
  - [`packages/react-reconciler/src/ReactFiber.js`][fiber]: `createFiberFromTypeAndProps`
  - [`packages/react-reconciler/src/ReactFiberBeginWork.js`][bw]: `beginWork`, `mountLazyComponent`
  - [`packages/react-reconciler/src/ReactFiberThenable.js`][thenable]: `resolveLazy`, `trackUsedThenable`, `SuspenseException`, `getSuspendedThenable`
  - [`packages/react-reconciler/src/ReactChildFiber.js`][cf]: lazy children and lazy types during child reconciliation
  - [`packages/react-reconciler/src/ReactFiberWorkLoop.js`][wl]: `handleThrow`, `renderRootSync`, `renderRootConcurrent`, `replaySuspendedUnitOfWork`, `attachPingListener`, `resolveRetryWakeable`
  - [`packages/react-reconciler/src/ReactFiberThrow.js`][throw]: `throwException`
  - [`packages/react-reconciler/src/ReactFiberCommitWork.js`][commit]: `attachSuspenseRetryListeners`
  - [`packages/react-reconciler/src/ReactFiberHooks.js`][hooks]: `use`
  - [`packages/react-server/src/ReactFizzServer.js`][fizz], [`packages/react-server/src/ReactFlightServer.js`][flight-server], [`packages/react-client/src/ReactFlightClient.js`][flight-client]
  - [`packages/react-reconciler/src/__tests__/ReactLazy-test.internal.js`][tests]: behaviour pinned by React's own tests
  - [`packages/shared/getComponentNameFromType.js`][name], [`packages/react-devtools-shared/src/backend/fiber/renderer.js`][devtools]

## Short answer

- `lazy(load)` allocates one object, `{$$typeof: REACT_LAZY_TYPE, _payload, _init}`, and does nothing else. The payload stores a status (`Uninitialized` -1, `Pending` 0, `Resolved` 1, `Rejected` 2) and a result. [`ReactLazy.js:23-26, 224-261`][lazy]
- The first time React needs the value, it calls `_init(_payload)`. That calls `load()` once, subscribes with `.then`, and moves the payload to `Pending`. While it is not `Resolved`, `_init` **throws** the stored value: the thenable while pending, the rejection reason once rejected. Once resolved it returns `module.default`. [`ReactLazy.js:68-222`][lazy]
- The reconciler wraps that call in `resolveLazy`. A thrown thenable is converted into the same opaque `SuspenseException` that `use()` throws, so a pending lazy suspends exactly like `use(promise)`. A thrown non-thenable is rethrown as an ordinary render error. [`ReactFiberThenable.js:356-375`][thenable]
- A rejection is cached on the payload for the lifetime of that lazy object. Every later render throws the same error again, so resetting an error boundary around a failed lazy does not retry the import. The docs say the promise and its resolved value are cached, and that a rejection is thrown to the nearest error boundary. They do not say the rejection is cached; the source does. [Docs][doc-lazy] · [`ReactLazy.js:132-140, 219-221`][lazy]
- On the server, Fizz calls `_init` directly and treats a thrown thenable as a suspended task. Flight uses lazy as its wire-level placeholder: a client component reference in element-type position is serialized as `$L<id>`, and the Flight client turns that into a lazy whose `_init` reads the module chunk. [`ReactFizzServer.js:2979-3000`][fizz] · [`ReactFlightServer.js:3158-3204`][flight-server] · [`ReactFlightClient.js:1636-1660, 2709-2723`][flight-client]

---

## 1. API contract

### What the docs promise

From the [`lazy` reference][doc-lazy]:

- `load` is "a function that returns a Promise or another _thenable_ (a Promise-like object with a `then` method)". It receives no parameters.
- "React will not call `load` until the first time you attempt to render the returned component."
- "Both the returned Promise and the Promise's resolved value will be cached, so React will not call `load` more than once. If the Promise rejects, React will `throw` the rejection reason for the nearest Error Boundary to handle."
- `load` "needs to eventually resolve to an object whose `.default` property is a valid React component type, such as a function, `memo`, or a `forwardRef` component."
- While loading, rendering the lazy component "will _suspend_". Wrap it, or any parent, in `<Suspense>`.
- Troubleshooting: "Do not declare `lazy` components _inside_ other components", because "all state" will be reset on re-renders; "always declare them at the top level of your module".

The [`<Suspense>` reference][doc-suspense] lists "Lazy-loading component code with `lazy`" among the things that activate a boundary, and its caveats apply unchanged: no state is preserved for a tree that suspended before its first mount, and an already revealed boundary falls back again unless the update was a Transition (`startTransition` / `useDeferredValue`).

### What the source enforces

`lazy` is typed as accepting `ctor: () => Thenable<{default: T, ...}>` [`ReactLazy.js:224-226`][lazy]. At runtime, only two things are checked, both after resolution:

```js
if (payload._status === Resolved) {
  const moduleObject = payload._result;
  if (__DEV__) {
    if (moduleObject === undefined) {
      console.error('lazy: Expected the result of a dynamic import() call. ' + ...
        'Did you accidentally put curly braces around the import?', ...);
    }
  }
  if (__DEV__) {
    if (!('default' in moduleObject)) {
      console.error('lazy: Expected the result of a dynamic import() call. ' + ...);
    }
  }
  return moduleObject.default;
}
```

[`ReactLazy.js:189-218`][lazy] (string concatenation abbreviated). Consequences, read from the code:

- **`.default` missing.** DEV logs "lazy: Expected the result of a dynamic import() call". `_init` returns `undefined`. `mountLazyComponent` then falls through every branch and throws `Element type is invalid. Received a promise that resolves to: undefined. Lazy element type must resolve to a class or function.` [`ReactFiberBeginWork.js:2181-2203`][bw]. React's test "does not support arbitrary promises, only module objects" (`lazy(async () => Text)`) asserts exactly this pair of DEV warning and thrown error. [`ReactLazy-test.internal.js:247-292`][tests]
- **Resolved value is `undefined`** (e.g. `() => { import('./X') }` with braces). DEV logs the "curly braces" hint, then `'default' in undefined` (DEV) or `undefined.default` (prod) throws a `TypeError`. That is an ordinary render error, so it goes to an error boundary. Not run; read from the code.
- **`.default` is not a component.** `mountLazyComponent` accepts a function (class or function component), or an object whose `$$typeof` is `forwardRef`, `memo`, or a context (rendered as a provider). Everything else throws the same "Element type is invalid" error. If `.default` is itself a lazy, DEV appends "Did you wrap a component in React.lazy() more than once?" [`ReactFiberBeginWork.js:2126-2203`][bw]. The test file pins this error for `Fragment`, `createPortal`, `Profiler`, `StrictMode`, `Suspense`, `Context.Consumer`, `SuspenseList`, `ViewTransition`, `Activity`, `TracingMarker`, and double-wrapped lazy. [`ReactLazy-test.internal.js:739-1089`][tests] The "renders a lazy context provider" test confirms the context case. [`ReactLazy-test.internal.js:119`][tests]
- **Any thenable works, not only `import()`.** The code only calls `ctor()` and `.then(onFulfilled, onRejected)`. React's tests use hand-written thenables. [`ReactLazy.js:86-93`][lazy] · [`ReactLazy-test.internal.js:157-210`][tests]

### Why lazy must be declared at module top level

The cache lives on the payload object that `lazy()` allocates. Calling `lazy()` inside a component creates a new lazy object, with a fresh `Uninitialized` payload, on every render.

In child reconciliation, an existing fiber is reused when `current.elementType === elementType`. For lazy there is a fallback: reuse it if `resolveLazy(elementType) === current.type`. [`ReactChildFiber.js:587-600`][cf] With a fresh lazy object the first check fails, and `resolveLazy` on the new object calls `load()` again. A real `import()` returns a promise that is pending at least until a microtask, so `_init` throws and the parent's reconciliation suspends. That is the mechanism behind the docs' warning. The source confirms the per-object cache and the identity check. **Not verified:** the exact sequence of renders that ends in the reported state reset. That was not traced or run.

There is also a DEV-only hint in `lazy()` itself: it does not record an owner because "It's unusual to create a lazy inside an owner though since they should be in module scope." [`ReactLazy.js:240-243`][lazy]

### DEV warnings and debug info, summarised

| Where                | Condition                           | Message or effect                                                                                                                   |
| -------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `lazyInitializer`    | resolved value is `undefined`       | `lazy: Expected the result of a dynamic import() call ... Did you accidentally put curly braces around the import?`                 |
| `lazyInitializer`    | resolved value has no `default` key | `lazy: Expected the result of a dynamic import() call ...`                                                                          |
| `mountLazyComponent` | `.default` is not a valid type      | throws `Element type is invalid. Received a promise that resolves to: ...` (prod too)                                               |
| `mountLazyComponent` | `.default` is another lazy          | adds `Did you wrap a component in React.lazy() more than once?`                                                                     |
| `lazy()`             | always in DEV                       | attaches `_debugInfo = [{awaited: ioInfo}]` with name `'lazy'`, a creation stack, and `console.createTask('lazy()')` when available |
| `lazyInitializer`    | thenable has a string `displayName` | renames the DEV `ioInfo` to it                                                                                                      |

[`ReactLazy.js:171-180, 189-217, 239-258`][lazy] · [`ReactFiberBeginWork.js:2181-2203`][bw]

---

## 2. Internal representation

### The object

```js
export type LazyComponent<T, P> = {
  $$typeof: symbol | number,
  _payload: P,
  _init: (payload: P) => T,

  // __DEV__
  _debugInfo?: null | ReactDebugInfo,
  _store?: {validated: 0 | 1 | 2, ...},
};
```

[`ReactLazy.js:58-66`][lazy]. `$$typeof` is `REACT_LAZY_TYPE = Symbol.for('react.lazy')` [`ReactSymbols.js:31`][symbols].

The renderers depend only on the `_payload` / `_init` protocol, so lazy is a general "value I may not have yet" box, not specific to code splitting. `React.lazy` uses `lazyInitializer` as `_init`. The Flight client uses `readChunk` [`ReactFlightClient.js:1636-1645`][flight-client]. The Flight server uses `readThenable` [`ReactFlightServer.js:1564-1625`][flight-server].

### The payload state machine

```js
const Uninitialized = -1;
const Pending = 0;
const Resolved = 1;
const Rejected = 2;
```

[`ReactLazy.js:23-26`][lazy]. `_result` changes meaning with `_status` [`ReactLazy.js:28-56`][lazy]:

| `_status`            | `_result`                    | `_init` does                                                                                                                                |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Uninitialized` (-1) | the `load` function          | calls it, subscribes, moves to `Pending` (or straight to `Resolved`/`Rejected` if the thenable settles synchronously), then continues below |
| `Pending` (0)        | the thenable `load` returned | `throw thenable`                                                                                                                            |
| `Resolved` (1)       | the module object            | `return module.default`                                                                                                                     |
| `Rejected` (2)       | the rejection reason         | `throw reason`                                                                                                                              |

`lazy()` itself only creates the payload with `_status: Uninitialized, _result: ctor` [`ReactLazy.js:227-237`][lazy]. Nothing runs until something calls `_init`.

### How `load` is called at most once

`lazyInitializer` [`ReactLazy.js:68-222`][lazy]:

1. Only in `Uninitialized` does it call `ctor()` (line 87) and attach `then` (line 93).
2. Both callbacks transition only if the status is still `Pending` or `Uninitialized` (lines 95-98, 133-136). A late or duplicate settlement cannot overwrite a settled payload.
3. After `.then` returns, if the status is still `Uninitialized` it becomes `Pending` with the thenable stored (lines 181-187). If the thenable called back synchronously, the payload is already `Resolved` or `Rejected`, and the same call returns or throws. React's tests "can resolve synchronously without suspending" and "can reject synchronously without suspending" cover this. [`ReactLazy-test.internal.js:157-210`][tests]
4. On settle it also writes `status`/`value` or `status`/`reason` onto the thenable if it has no `status` yet (lines 124-129, 162-167). That is the same expando protocol `use()` relies on. The work loop reads it through `isThenableResolved` to decide whether to replay instead of showing a fallback (section 3).

One exception to "at most once": if `ctor()` throws synchronously, or the returned value has no callable `then`, the exception escapes before the status changes. The payload stays `Uninitialized`, and the next render calls `load` again. The source states this intent (lines 88-92): "This might throw either because it's missing or throws. If so, we treat it as still uninitialized and try again next time." So **synchronous** failures are retried and **asynchronous** rejections are cached.

---

## 3. Reconciler integration

### Lazy as a component type: `LazyComponent` fiber

When an element's `type` is a lazy object, `createFiberFromTypeAndProps` gives the fiber tag `LazyComponent` (16) and leaves `type` null. `elementType` keeps the lazy object. [`ReactFiber.js:659-662`][fiber] · [`ReactWorkTags.js:59`][tags]

`beginWork` dispatches `LazyComponent` to `mountLazyComponent` [`ReactFiberBeginWork.js:4319-4327`][bw], which:

1. calls `resolveLazy(lazyComponent)`. This may throw to suspend or to error;
2. stores the result in `workInProgress.type` ("Store the unwrapped component in the type.", line 2124);
3. **rewrites the fiber's tag** to `ClassComponent`, `FunctionComponent`, `ForwardRef`, `MemoComponent`, or `ContextProvider`, and continues with that type's mount path in the same pass. [`ReactFiberBeginWork.js:2109-2180`][bw]

Because the tag is rewritten on mount, later updates never see `LazyComponent`. The fiber is an ordinary function or class fiber whose `elementType` is still the lazy object. On re-render, `updateElement` matches `current.elementType === elementType` by reference and never calls `resolveLazy`. [`ReactChildFiber.js:587-600`][cf] The lazy indirection costs nothing after mount.

### Lazy as a child: lazy nodes

A lazy object can also appear where a React node is expected, e.g. `{lazyNode}` in JSX. `ReactChildFiber.js` handles `REACT_LAZY_TYPE` children in each child-reconciliation path by resolving and recursing on the result:

| Function                   | Lines                | Behaviour                                                         |
| -------------------------- | -------------------- | ----------------------------------------------------------------- |
| `createChild`              | [753-759][cf-753]    | `createChild(returnFiber, resolveLazy(newChild), lanes)`          |
| `updateSlot`               | [892-903][cf-892]    | `updateSlot(returnFiber, oldFiber, resolveLazy(newChild), lanes)` |
| `updateFromMap`            | [1026-1037][cf-1026] | same, keyed-map pass                                              |
| `warnOnInvalidKey` (DEV)   | [1145-1154][cf-1145] | resolves to validate keys                                         |
| `reconcileChildFibersImpl` | [1890-1901][cf-1890] | single child: reconcile the resolved value                        |

So a lazy node is not a fiber. It is replaced by whatever it resolves to (an element, a string, an array...), and its key and type take part in reconciliation as if they had been written inline. The test "mount and reorder lazy elements" exercises this with lazies that resolve to keyed elements. [`ReactLazy-test.internal.js:1550`][tests] With `React.lazy` that value is still `module.default`, because `lazyInitializer` always returns `.default`. The Flight client's lazy returns the chunk value directly.

For lazy **types** in a slot, the extra condition in `updateElement` and `reconcileSingleElement` reuses an existing fiber if the new lazy resolves to the fiber's current `type`, even if the lazy object differs. The comment says this must run after the hot-reload check "because hot reloading has different semantics than prod because it doesn't resuspend. So we can't let the call below suspend." [`ReactChildFiber.js:593-600, 1728-1735`][cf] That call can suspend in production.

### From a pending thenable to `SuspenseException`

`resolveLazy` is the single entry point used by begin work and child reconciliation:

```js
export function resolveLazy<T>(lazyType: LazyComponentType<T, any>): T {
  try {
    if (__DEV__) {
      return callLazyInitInDEV(lazyType);
    }
    const payload = lazyType._payload;
    const init = lazyType._init;
    return init(payload);
  } catch (x) {
    if (x !== null && typeof x === 'object' && typeof x.then === 'function') {
      // This lazy Suspended. Treat this as if we called use() to unwrap it.
      suspendedThenable = x;
      if (__DEV__) {
        needsToResetSuspendedThenableDEV = true;
      }
      throw SuspenseException;
    }
    throw x;
  }
}
```

[`ReactFiberThenable.js:356-375`][thenable]. `callLazyInitInDEV` is the same call wrapped in a function named `react_stack_bottom_frame` for DEV stack traces. [`ReactFiberCallUserSpace.js:218-229`][userspace]

`SuspenseException` is a shared, opaque `Error` ("Suspense Exception: This is not a real error! ...") [`ReactFiberThenable.js:54-62`][thenable]. The real thenable is stashed in the module variable `suspendedThenable`, and the work loop retrieves it with `getSuspendedThenable()` [`ReactFiberThenable.js:380-399`][thenable]. This is the same channel `use()` uses through `trackUsedThenable` [`ReactFiberThenable.js:122-345`][thenable], with one difference: **lazy does not go through `trackUsedThenable`**. It does not use per-component `ThenableState`, it gets no "uncached promise" warning, and the thenable gets no `status: 'pending'` expando. It does not need any of that because the payload is the cache. `use()` itself accepts only thenables and contexts, not lazy objects. [`ReactFiberHooks.js:1159-1179`][hooks]

### Fallback and retry

`handleThrow` maps `SuspenseException` to the real thenable and sets `workInProgressSuspendedReason = SuspendedOnImmediate`. [`ReactFiberWorkLoop.js:2315-2352`][wl] What happens next depends on the render mode:

- **Sync render** (`renderRootSync`): `SuspendedOnImmediate` goes straight to `throwAndUnwindWorkLoop`. [`ReactFiberWorkLoop.js:2703-2713`][wl]
- **Concurrent render** (`renderRootConcurrent`): `SuspendedOnImmediate` becomes `SuspendedAndReadyToContinue` and the loop yields: "it's possible the data is already cached. Yield to the main thread to give it a chance to ping." On resume, if `isThenableResolved(thenable)`, React **replays** the same fiber without unwinding (`replaySuspendedUnitOfWork`). Otherwise it unwinds. [`ReactFiberWorkLoop.js:2890-2921`][wl] Replaying a non-function fiber such as `LazyComponent` resets it and calls `beginWork` again. [`ReactFiberWorkLoop.js:3222-3236`][wl] This is why `lazyInitializer` writes `status`/`value` onto the thenable: a module that is already cached, or that resolves within a microtask, can avoid the fallback.

Unwinding goes through `throwException`, which marks the fiber `Incomplete`. It then finds the nearest Suspense (or Activity/Offscreen) handler, marks it `ShouldCapture`, and adds the thenable to the boundary's retry queue (`updateQueue` Set). In concurrent mode it also calls `attachPingListener(root, wakeable, lanes)`. If no boundary exists in a concurrent root, the render suspends without committing (`renderDidSuspendDelayIfPossible`). [`ReactFiberThrow.js:364-550`][throw]

From there, two listeners bring the content back:

- **Ping** (render phase): `attachPingListener` attaches `pingSuspendedRoot` to the thenable, deduped per root and lane set. If the module arrives before a fallback is committed, the root re-renders on the same lanes. [`ReactFiberWorkLoop.js:4982-5028`][wl]
- **Retry** (after the fallback commits): `attachSuspenseRetryListeners` attaches `resolveRetryWakeable(boundaryFiber, wakeable)` to every wakeable in the boundary's retry queue, memoized in a per-boundary retry cache. On settle, `retryTimedOutBoundary` schedules a render of that boundary at a retry lane. [`ReactFiberCommitWork.js:1932-1962`][commit] · [`ReactFiberWorkLoop.js:5149-5200`][wl]

On the retry render, `_init` finds the payload `Resolved` and returns synchronously, and the subtree mounts. Per the Suspense docs, a tree that suspended before its first mount keeps no state and is rendered "from scratch". [Docs][doc-suspense] The "multiple lazy components" test shows two lazies under one boundary revealed only when both have loaded. [`ReactLazy-test.internal.js:212-245`][tests]

Already visible content falls back the same way when a lazy suspends during an update, unless the update is a Transition. `shouldRemainOnPreviousScreen` keeps the previous screen during transition lanes in the shell. [`ReactFiberWorkLoop.js:2445-2470`][wl] · [Docs: preventing already revealed content from hiding][doc-suspense-transition]

---

## 4. Error handling

A rejected `load` follows this path:

1. The rejection callback stores the reason: `_status = Rejected`, `_result = error`. [`ReactLazy.js:132-140`][lazy]
2. The next `_init` call reaches `throw payload._result` [`ReactLazy.js:219-221`][lazy]. If the rejection arrived while a fallback was showing, the retry listener (section 3) schedules that call. `resolveLazy` sees a non-thenable and rethrows it unchanged. [`ReactFiberThenable.js:373`][thenable]
3. `handleThrow` classifies it as `SuspendedOnError` [`ReactFiberWorkLoop.js:2368-2380`][wl], and `throwException` falls through to the regular error path, which captures to the nearest error boundary. During hydration it may instead try a client re-render under the nearest Suspense boundary. [`ReactFiberThrow.js:551-`][throw]

React's test "throws if promise rejects" asserts that the thrown error is the **same object** as the rejection reason (`expect(error).toBe(networkError)`), after a `Loading...` fallback. [`ReactLazy-test.internal.js:294-320`][tests]

**Does a failed lazy retry?** No, not by itself. Once `_status` is `Rejected`, nothing in `lazyInitializer` moves it back. Every later `_init` on that object rethrows the same reason without calling `load`. An error boundary that resets its state and renders the same lazy element again will hit the same error at once. The exceptions are synchronous throws from `load` or from `then` (section 2), which leave the payload `Uninitialized`.

Implications:

- Retrying requires a **new lazy object**. One option is retry logic inside `load`, so the promise React sees only rejects after the retries are used up. Another is to replace the lazy object (held in module scope or state, not created during render) when the boundary resets. Swapping the object changes `elementType` and remounts that subtree, which is acceptable when it previously failed.
- Whether re-calling `import()` with the same specifier after a failed network fetch actually fetches again is host behaviour (browser module map, bundler runtime), not React's. **Not verified** here.
- Error boundaries are class components (`getDerivedStateFromError`, optional `componentDidCatch`). They do not catch errors in event handlers, async code, or server-side rendering. [Docs][doc-eb] Per the Suspense docs, during streaming SSR a server error emits the nearest Suspense fallback, and the client tries again. [Docs][doc-suspense-server]

---

## 5. Server rendering (Fizz) and Server Components (Flight)

### Fizz

Fizz does not use `resolveLazy`. It calls `_init(_payload)` directly, in two places:

- **Lazy type:** `renderElement` routes `REACT_LAZY_TYPE` to `renderLazyComponent`, which calls `_init` and renders the resolved type with the same props. [`ReactFizzServer.js:3214-3217, 2979-3000`][fizz]
- **Lazy node:** `renderNodeDestructive` calls `_init` and continues with `renderNodeDestructive` on the resolved value. [`ReactFizzServer.js:3636-3653`][fizz]

A pending lazy therefore throws the raw thenable. `renderNode`'s catch accepts either `SuspenseException` (mapped through `getSuspendedThenable`) or any thrown object with a `then`. It spawns a suspended task and subscribes `ping` to the thenable, so the enclosing Suspense boundary streams its fallback and the content follows later. [`ReactFizzServer.js:4410-4485, 4593-4599`][fizz] Rejections are ordinary errors, so per the Suspense docs Fizz emits the fallback and leaves the retry to the client. [Docs][doc-suspense-server] Payload caching is the same as on the client, because it lives in the lazy object: in a long-lived server process, one module-level lazy resolves once for all requests. That follows from the code; it was not measured.

### Flight server

The Flight server unwraps lazies it meets in the model (`renderElement` for lazy types, `renderModelDestructive` for lazy values) by calling `_init`. [`ReactFlightServer.js:2402-2420, 3934-3960`][flight-server] If that throws a thenable, `renderModel` creates a new task, subscribes `ping`, and, when the value was a React element or lazy, writes a **lazy reference** `$L<taskId>` in its place. This keeps a suspended child from blocking its parent row. [`ReactFlightServer.js:3669-3747`][flight-server]

Lazy is also how Flight wraps async Server Component output. When a Server Component returns a thenable, `createLazyWrapperAroundWakeable` returns `{$$typeof: REACT_LAZY_TYPE, _payload: thenable, _init: readThenable}`. The source carries the TODO "Once we accept Promises as children on the client, we can just return the thenable here." [`ReactFlightServer.js:1564-1625, 1695-1704`][flight-server]

### Client references

When `serializeClientReference` encodes a client component used as an element's **type** (`parent[0] === REACT_ELEMENT_TYPE && parentPropertyName === '1'`), it emits an import row and returns `$L<importId>` instead of a plain `$<id>`:

```js
// If we're encoding the "type" of an element, we can refer
// to that by a lazy reference instead of directly since React
// knows how to deal with lazy values. This lets us suspend
// on this component rather than its parent until the code has
// loaded.
return serializeLazyID(importId);
```

[`ReactFlightServer.js:3158-3204`][flight-server] · [`serializeLazyID`, line 3064][flight-server-3064]

### Flight client

`parseModelString` turns every `$L<id>` into `createLazyChunkWrapper(getChunk(response, id))`. That is a lazy whose `_payload` is the chunk and whose `_init` is `readChunk`. [`ReactFlightClient.js:2709-2723, 1636-1660`][flight-client] `readChunk` initializes resolved model or module chunks, returns `chunk.value` when `INITIALIZED`, **throws the chunk itself** (a thenable) when `PENDING`, `BLOCKED`, or `HALTED`, and throws `chunk.reason` otherwise. [`ReactFlightClient.js:463-488`][flight-client]

For an import row, `resolveModule` calls the bundler config's `resolveClientReference` and `preloadModule`. The comment says "For now we preload all modules as early as possible since it's likely that we'll need them". If `preloadModule` returns a promise, the chunk is `BLOCKED` until it resolves. Then `initializeModuleChunk` calls `requireModule` synchronously. [`ReactFlightClient.js:3422-3489, 1277-1290`][flight-client] The webpack implementations are in [`ReactFlightClientConfigBundlerWebpack.js:198, 236`][webpack].

The client reconciler handles these through the same `resolveLazy` → `SuspenseException` path as `React.lazy`. A client component whose code has not loaded suspends **at that element**, not at its parent, which is the stated purpose of the `$L` encoding. Unlike `React.lazy`, `readChunk` returns the chunk value itself, not `.default`. The export is chosen by the client reference metadata. The code-split loading starts when the import row is parsed, not on first render.

---

## 6. Practical implications for library authors

**Declare lazies once, at module scope.** The payload is the cache and object identity is the reconciliation key. A lazy created during render reloads, and can remount. (Section 1)

**Preloading.** React has no preload API on lazy objects, and `_payload`/`_init` are internal. Because `lazy` calls `load` at most once and stores whatever thenable it returns, a library can memoize its own loader and hand the same function to both `lazy` and a `preload` export:

```ts
import { lazy, type ComponentType } from "react";

export function lazyWithPreload<T extends ComponentType<never>>(load: () => Promise<{ default: T }>) {
	let pending: Promise<{ default: T }> | undefined;
	const preload = () => (pending ??= load());
	return Object.assign(lazy(preload), { preload });
}
```

Calling `preload()` on hover or in a route loader starts the request early. When React later calls `_init`, it calls the same memoized function and receives the same promise. If the promise has already settled, React still subscribes via `.then`, so a native promise resolves in a microtask, not synchronously. In a concurrent render this usually means the "yield, then replay" path (section 3) rather than a committed fallback. **Not verified** by running. The example was not type-checked against `@types/react`.

**Avoiding suspension entirely.** If `load` returns a thenable that calls `onFulfilled` synchronously, `lazyInitializer` returns `module.default` in the same call and nothing suspends. React tests this. [`ReactLazy-test.internal.js:157-176`][tests] A library that already holds the module (e.g. after a preload) can return such a thenable. Native `Promise.resolve(module)` does not qualify, because its callbacks are always asynchronous.

**Caching and failure.** A rejection is permanent for that lazy object (section 4). Put retry and backoff inside `load`, or provide a way to swap in a fresh lazy object when an error boundary resets. Do not rely on a boundary reset alone. A synchronous throw from `load` is the one case React retries on the next render.

**Not a general promise unwrapper.** `React.lazy` always returns `.default`. To read arbitrary async values, use `use(promise)` with a cached promise. [Docs][doc-use] Lazy nodes in child position, as used by Flight, are a renderer feature; `React.lazy` itself still requires a `{default}` module shape.

**DevTools and component names.**

- After mount the fiber's `type` is the resolved component (section 3), so DevTools and error messages show the resolved component's `displayName` or function name. Set `displayName` on the default export, not on the lazy object.
- `getComponentNameFromType` for a lazy type calls `_init(_payload)` and returns `null` if it throws. Asking for an unresolved lazy's name in DEV tooling can therefore **start the load**. [`getComponentNameFromType.js:121-130`][name]
- While unresolved, the component stack shows the frame `Lazy`. [`ReactFiberComponentStack.js:43-45`][stack] React's tests distinguish "a component stack naming the resolved component" from "a component stack containing Lazy if unresolved". [`ReactLazy-test.internal.js:1374-1452`][tests]
- In DEV, each lazy carries `_debugInfo = [{awaited: ioInfo}]` named `'lazy'`, with start and end timestamps set when `load` is called and when it settles. If the thenable has a string `displayName`, that becomes the name. DevTools' `trackDebugInfoFromLazyType` reads this into the "suspended by" data for the fiber, so a library can label its loads by setting `displayName` on the returned thenable. [`ReactLazy.js:72-85, 171-180, 239-258`][lazy] · [`renderer.js:2822-2839`][devtools]

---

## Unverified / out of scope

- No code was executed. Behaviour claims come from reading the source and React's own tests at the pinned commit. The sequence that produces the docs' "state gets reset" symptom for lazies declared in render was not traced end to end.
- Whether a retried `import()` of the same specifier refetches after a network failure depends on the host and bundler, and was not checked.
- Legacy-mode (`ReactDOM.render`) differences (`resetSuspendedCurrentOnMountInLegacyMode`, no ping listeners) were not studied.
- `defaultProps` resolution for lazy class components (`resolveClassComponentProps`) is exercised by tests but was not examined.
- The Flight paths for prerender/halt (`outlineHaltedTask`), debug-channel chunks, and non-webpack bundler configs were skimmed only where they touch lazy.

[doc-lazy]: https://react.dev/reference/react/lazy
[doc-suspense]: https://react.dev/reference/react/Suspense
[doc-suspense-transition]: https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding
[doc-suspense-server]: https://react.dev/reference/react/Suspense#providing-a-fallback-for-server-errors-and-client-only-content
[doc-use]: https://react.dev/reference/react/use
[doc-eb]: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
[lazy]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react/src/ReactLazy.js
[symbols]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/shared/ReactSymbols.js#L31
[fiber]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiber.js#L659-L662
[tags]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactWorkTags.js#L59
[bw]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberBeginWork.js#L2109-L2204
[thenable]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberThenable.js
[userspace]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberCallUserSpace.js#L218-L229
[cf]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js
[cf-753]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js#L753-L759
[cf-892]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js#L892-L903
[cf-1026]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js#L1026-L1037
[cf-1145]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js#L1145-L1154
[cf-1890]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactChildFiber.js#L1890-L1901
[wl]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberWorkLoop.js
[throw]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberThrow.js#L364-L550
[commit]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberCommitWork.js#L1932-L1962
[hooks]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberHooks.js#L1159-L1179
[fizz]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-server/src/ReactFizzServer.js
[flight-server]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-server/src/ReactFlightServer.js
[flight-server-3064]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-server/src/ReactFlightServer.js#L3064-L3066
[flight-client]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-client/src/ReactFlightClient.js
[webpack]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-server-dom-webpack/src/client/ReactFlightClientConfigBundlerWebpack.js
[tests]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/__tests__/ReactLazy-test.internal.js
[name]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/shared/getComponentNameFromType.js#L121-L130
[stack]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-reconciler/src/ReactFiberComponentStack.js#L43-L45
[devtools]: https://github.com/facebook/react/blob/1620f7b943eb5de6a055e8eb042ad6e36b5317d4/packages/react-devtools-shared/src/backend/fiber/renderer.js#L2822-L2839
