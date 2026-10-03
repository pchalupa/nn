# Store notification batching

Researched 2026-10-02. This is research for extracting Store notification batching into a small, per-Store `Batch` class. No implementation is included. Local observations refer to the working tree inspected at HEAD `623b119a666db94bc7465b4425849d92c272f648`.

## Recommendation

We can use the proposed coordinator: one depth counter, one pending flag, and one notification callback per Store. `run(callback)` enters a synchronous scope and leaves it in `finally`; only the outermost exit flushes pending work. `notify()` marks pending inside the scope and calls the notification callback immediately outside it. Clear pending before invoking user code.

MobX's small `transaction` wrapper is the closest precedent. Preact Signals also exits batching in `finally`. Their full reaction schedulers do more than we need, so the useful part is the scope and cleanup pattern. Keep Store's emitter and subscription API in Store. Keep equality checks in the mutation/diff layer. [mobx-transaction] [mobx-batch] [signals]

Two details need an explicit contract:

1. **Failure:** flush notifications for mutations that already happened, even when applying the rest of a patch fails. Plain `finally` can replace that mutation error if a subscriber also throws. My recommendation is to preserve both errors in that double-failure case, for example with an `AggregateError`, while propagating the original error unchanged when it is the only failure. This is a recommendation, not a shared library convention. If the extraction keeps plain `finally`, record its error precedence explicitly.
2. **Reentrancy:** preserve today's immediate, recursive emission and snapshot listener traversal. Clearing pending prevents stale work, but does not prevent recursive notifications or make every subscriber observe the same state. Adding a flush queue would be a separate behavior change. [store] [emitter] [try-finally]

Call this **notification batching**. It groups Store subscriber calls; it does not provide rollback, isolated reads, atomic patch application, or an atomic persistence commit. [store] [patch]

## What the local code does today

These are verified source observations, with consequences derived from that control flow.

- `Store.update` runs the recipe and computes a diff before entering `transaction`. A `none` patch returns without notification. The batch covers `applyPatch`, not the recipe. Extracting the helper need not move that boundary. A recipe that throws normally fails before entity writes, but arbitrary side effects performed by the recipe are outside that guarantee. [store]
- `applyPatch` writes fields and list operations in sequence. It can throw after earlier operations have succeeded, for example when a later target is missing or a callback invoked by an entity write throws. There is no rollback path. [patch] [entity] [emitter]
- The existing `transaction` resets its boolean in `finally`, but flushes **after** the `try/finally`. An application error skips the flush and leaves pending set. A later transaction can deliver that stale notification. Moving the flush into cleanup therefore changes failure behavior, even if successful updates look identical. [store]
- The boolean cannot represent nesting. An inner transaction sets it back to false and may flush before an outer application finishes. A depth counter models this correctly. This is a structural limitation; this research did not establish a normal public-API reproduction for nested patch application. [store]
- Store subscribes its notification handler to each top-level entity, then installs a separate persistence subscriber. Repository `set` and `delete` calls start from those entity callbacks; Store does not wait for their promises before finishing an update. Batching Store notifications does not group or await those writes. [store]
- `EventEmitter.emit` copies the listener Set with `Array.from` and invokes listeners synchronously in order. A throw stops the current traversal. Adding or removing listeners affects later emissions, including nested ones, but not the array already being traversed. [emitter]
- Dirty tracking means “an entity notification occurred,” not “the final projected value differs.” `LWWRegister.current` emits even when assigned an equal value. `Store.update`'s diff removes ordinary no-op recipes before application, but a generic Batch cannot infer semantic equality from `notify()`. [store] [register]

One persistence caveat matters: “immediate persistence subscribers” describes timing, not guaranteed delivery. Outside a Store batch, its earlier notification handler can invoke a throwing Store subscriber and stop the entity emitter before the persistence callback is reached. Other earlier throwing entity callbacks can also interrupt delivery. During ordinary batched application, Store's handler only marks pending, so it does not invoke Store subscribers at that point. The extraction should not claim stronger persistence guarantees than this. [store] [emitter]

## Comparison with primary sources

### MobX transactions and actions

**Verified:** `transaction` calls `startBatch`, executes the callback, and calls `endBatch` in `finally`. `startBatch` increments a global counter; `endBatch` decrements it and starts reactions at zero. Actions use that machinery plus tracking and mutation-permission bookkeeping. Public documentation says reactions wait for the outermost action and that updates after `await` need their own action. [mobx-transaction] [mobx-batch] [mobx-action] [mobx-docs]

**Verified:** reactions have their own pending queue and scheduling flags. `runReactions` returns while already running, and the outer drain processes newly queued reactions in later passes, with a 100-iteration convergence limit. This is queued reentrancy, unlike our emitter's recursive calls. Ordinary reaction errors are reported rather than rethrown by default; per-reaction handlers and `disableErrorBoundaries` can change that. When an action failed, `_endAction` sets a flag to suppress the usual reaction-error reporting. This is not a universal guarantee that cleanup can never throw or mask an action error. [mobx-reaction] [mobx-action]

**Verified:** low-level `observe` listeners still fire for each mutation inside a transaction. MobX explicitly distinguishes those mutation listeners from reactions to new values. This is a useful parallel for our immediate entity/persistence subscriptions and batched Store subscriptions. [mobx-observe]

**Takeaway:** copy the depth and cleanup discipline. A single callback does not need MobX's dependency graph, global scheduler, action permissions, or cycle threshold. Its low-level transaction name does not establish rollback: the inspected wrapper only manages batching. [mobx-transaction]

### Solid `batch`

**Verified:** Solid documents nested batches as one batch, current reads inside the batch, and batching only before the first async suspension. The implementation uses an existing update queue as the nesting marker rather than a numeric counter. Signal writes compare values before scheduling dependents, and normal writes assign the signal value immediately. [solid-docs] [solid-source]

**Important difference:** `runUpdates` calls `completeUpdates` only after `fn()` returns successfully. Its catch path clears update/effect queue references as applicable and passes the error to `handleError`. Without an error handler, that path throws. It does **not** use an unconditional finally-flush after a failing outer callback. Previously assigned values are not restored by this code. Therefore Solid is evidence for nested synchronous batching, not evidence that all batching libraries flush failed work identically. This observation concerns the ordinary client batch path, not transitions or server rendering. [solid-source]

**Takeaway:** mutation visibility and effect delivery are separate concerns. Choose Store's failure policy based on its mutable entities rather than treating Solid's queue cleanup as a universal rule.

### Preact Signals `batch`

**Verified:** `batch` runs nested callbacks under an already active batch and uses `try/finally` for the outer call. Setters change values immediately, skip equal assignments, and queue effect work. During flush, depth remains active; the drain detaches the current effect list and clears each effect's notified flag before invoking it. New work is drained in subsequent passes. Effect failures are collected while remaining eligible effects continue, and the first captured error is thrown after depth is decremented. [signals]

**Failure consequence:** if the batch body throws and a flushed effect also throws, `endBatch` throws from `finally`, replacing the body's error. That follows directly from this implementation and JavaScript's finally rules. Preact's effort to continue other effects is a separate policy from preserving the body error. [signals] [try-finally]

**Version-specific no-op behavior:** the inspected source also records pre-batch signal values and reconciles subscriptions when a signal returns to its original value. This avoids some end-of-batch recomputation; it does not undo writes on failure. A boolean pending flag cannot promise this behavior. There is no need to add snapshots to our Batch to imitate it. [signals]

**Takeaway:** clearing pending before calling out is well supported. The queue, effect isolation, dependency versions, and cycle detection belong to a reactive engine. Keeping their behavior would be substantially more than this extraction.

### React batching

**Verified:** React batches queued component state updates to reduce renders. React 18 extended automatic batching to updates in timeouts, promises, native event handlers, and other callbacks. Its teaching documentation describes state values as fixed for the current render and distinguishes separate intentional events such as clicks. These are render scheduling semantics, not a per-Store synchronous `run` scope. [react-batching] [react-18]

**Verified distinction:** Redux Toolkit's own documentation says React's `unstable_batchedUpdates` combines renders but does not change subscriber notifications. Therefore React batching does not replace the work our Batch performs for arbitrary Store subscribers. [rtk-docs]

**Takeaway:** use React as evidence that reducing render work and reducing Store listener calls are separate optimizations. Its docs do not specify the double-error or listener-traversal contract for our emitter.

### Redux subscriber batching

**Verified:** Redux core normally calls subscribers after every successful dispatch, including dispatches that return the same state. Its subscription list is snapshotted. Subscribers may dispatch recursively, and a later listener can see state changed by that nested dispatch rather than every intermediate state. The source invokes callbacks directly, so a throwing subscriber aborts the remaining traversal. [redux-docs] [redux-source]

**Verified:** `redux-batched-subscribe` calls a supplied `batch(notifyListeners)` function after the underlying dispatch succeeds. It snapshots subscribers through copy-on-write arrays and exposes `subscribeImmediate`. It does not itself implement nested depth or automatic deduplication; the supplied batching function controls when notification happens. If the underlying dispatch throws, its post-dispatch batch call is skipped. This small enhancer is useful evidence for separating mutation from subscriber delivery, not an exact implementation template. [redux-batched]

**Verified:** Redux Toolkit's `autoBatchEnhancer` delays notifications for specially marked low-priority actions while reducers still run immediately. It tracks whether a notification is queued and needed, clears those flags before delivery, and restores its ordinary notifying flag in `finally` around dispatch. It supports animation-frame, microtask, timer, and custom scheduling. Its delayed delivery traverses a live Set using `forEach`, unlike our emitter's snapshot array. [rtk-source] [rtk-docs]

**Takeaway:** keep subscriber batching local to the Store, but keep our explicit synchronous scope. Copying Toolkit's scheduling or live-Set traversal would change timing and subscription mutation behavior without helping the extraction.

## The proposed Batch's exact boundaries

The following are deductions from the proposed algorithm plus the local emitter, not claims that it is already implemented.

### Depth and pending

Only `notify()` should set pending. An empty `run`, a read-only scope, or nested empty scopes must not emit. Nested dirty scopes remain pending until the outermost exit, including when an inner exception is caught by the outer callback. Each Store has its own depth and pending state, so Store A's scope does not hold back Store B's notification.

Pending is an invalidation marker: consumers should read current state. It is not an operation count, change log, or comparison of final values. A write followed by its inverse can still emit once. This matches the information available from our entity callbacks. [store] [register]

### Failure and partial application

Run cleanup must restore depth before invoking notifications and clear pending before emission. If the body throws without any `notify()`, there is nothing to flush. If it throws after a notification request, flushing lets subscribers observe the partial state that remains. Clearing state before calling out also means a subscriber error cannot leave the coordinator permanently batching or cause a later empty run to replay stale work. [patch] [emitter]

Plain `try/finally` has this error table. [try-finally]

| Body     | Flush    | Observable result               |
| -------- | -------- | ------------------------------- |
| Succeeds | Succeeds | Normal completion               |
| Throws A | Succeeds | A propagates after notification |
| Succeeds | Throws B | B propagates; mutations remain  |
| Throws A | Throws B | B propagates; A is replaced     |

If we preserve both failures as recommended, only the last row needs a different rule. Use a separate “body threw” flag if implementing this later: JavaScript permits thrown values such as `undefined`, so `error !== undefined` cannot reliably distinguish success from failure. The ECMAScript throw algorithm carries the expression's value without requiring an `Error` object. [throw]

This policy would preserve the body error and the first emitter error, not collect every subscriber error. Our emitter stops at the first throw. Continuing other listeners or retrying failed delivery would need a separate emitter policy. [emitter]

### Reentrant emission and traversal

Suppose listeners A and B are registered, and A performs one guarded update during a flush:

1. The outer flush starts at depth zero with pending already cleared.
2. A's update enters and leaves a new batch, which emits immediately.
3. The nested emission calls A and B.
4. The original emission resumes and calls B again.

The call order is A, A, B, B. B can read the newest state twice and never observe the state that originally triggered the outer emission. Removing B in A does not remove it from the outer snapshot, although a nested emission uses the changed listener set. Adding C in A makes C eligible for a nested emission but not for the outer one. These are consequences of `Array.from(listeners)` and synchronous calls. Redux documents a comparable nested-dispatch snapshot contract. [emitter] [redux-docs]

Clearing pending before callback execution is necessary housekeeping, not a recursion guard. An unconditional write from a listener can recurse indefinitely. MobX and Preact use drain loops to avoid immediate recursive flushes and detect some cycles; those mechanisms also change ordering and error behavior. Keep today's contract for this extraction, and only add a queue if there is a concrete requirement for pass-by-pass delivery. [mobx-reaction] [signals]

### Synchronous scope and persistence

The proposed scope ends when the callback returns, including when it returns a Promise. Writes after `await` are outside that scope. MobX and Solid explicitly document this synchronous boundary; Preact's wrapper also does not await its return value. Do not hold a Store's depth open while waiting for asynchronous work, because unrelated updates could then be silently grouped into the same scope. [mobx-docs] [solid-docs] [signals]

Entities remain readable during application, entity listeners can run between operations, and repository calls may already have started when application fails. One batched notification therefore says only “read the current Store state.” It says nothing about persistence completion or an all-or-nothing commit. [store] [patch] [entity]

## Meaningful behavioral cases for a later implementation

These are recommended checks, not tests added or executed by this research.

| Case                                                   | Expected contract                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `notify()` outside a scope                             | Callback runs before `notify()` returns.                                                              |
| Empty run; nested empty runs                           | No notification.                                                                                      |
| Several requests, including a nested run               | No early notification; one at the outer exit.                                                         |
| Inner failure caught by outer callback                 | Depth remains active; later writes join one outer flush.                                              |
| Body throws before requesting notification             | Same failure; no notification; next run works.                                                        |
| Body requests notification, then throws                | One flush of remaining state before failure escapes; next empty run is silent.                        |
| Flush callback throws                                  | Coordinator is reusable; no stale pending replay.                                                     |
| Body and flush both throw                              | Explicitly chosen double-error contract; cover a non-`Error` thrown value too.                        |
| Guarded update from listener A with listener B present | Immediate nested emission, A/A/B/B order; B reads latest state.                                       |
| Subscribe/unsubscribe during notification              | Outer snapshot stays fixed; nested emission sees the new set.                                         |
| Listener A throws before B                             | B is not called by that traversal under the current emitter contract.                                 |
| Store A runs while Store B changes                     | B emits immediately; A's counter has no effect on B.                                                  |
| Ordinary no-op recipe                                  | No entity application, Store notification, or new persistence call.                                   |
| Multi-operation patch partially fails                  | Applied prefix remains; notification reflects that prefix; already-started persistence is not undone. |
| Successful multi-operation patch with persistence      | Entity callbacks and repository calls occur during application; Store emits once afterward.           |
| Promise-returning callback, if accepted                | Synchronous requests flush on return; requests after suspension are outside that scope.               |

The most valuable integration case is a real partial patch failure after at least one entity has emitted. It distinguishes finally-flushing from the current stale-pending behavior. The most valuable reentrancy case asserts call order and observed state, not just a final notification count. [store] [patch] [emitter]

## Source versions and limits

Source links below pin the inspected code to commits. Package versions are those declared at those commits, not a claim that a release tag or published package contains identical code. Official documentation was read on 2026-10-02 and can change independently.

| Project                 | Declared package version                                                                                                         | Inspected commit                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| MobX                    | [`7.0.6`](https://github.com/mobxjs/mobx/blob/ed5e082d7392466ee4507756ed71205c7d654d64/packages/mobx/package.json)               | `ed5e082d7392466ee4507756ed71205c7d654d64` |
| Solid                   | [`1.9.15`](https://github.com/solidjs/solid/blob/b25c557754f2ced0d86490e6dbfded9b1745b663/packages/solid/package.json)           | `b25c557754f2ced0d86490e6dbfded9b1745b663` |
| Preact Signals core     | [`1.14.4`](https://github.com/preactjs/signals/blob/877e461350556815a631447a3e702ad1063c43a0/packages/core/package.json)         | `877e461350556815a631447a3e702ad1063c43a0` |
| Redux                   | [`5.0.1`](https://github.com/reduxjs/redux/blob/56abca4749921d68f40cda20afd2043af9751f72/package.json)                           | `56abca4749921d68f40cda20afd2043af9751f72` |
| Redux Toolkit           | [`2.13.0`](https://github.com/reduxjs/redux-toolkit/blob/e7a8b318df28aaf50ced1e65cd4636b7508263b2/packages/toolkit/package.json) | `e7a8b318df28aaf50ced1e65cd4636b7508263b2` |
| redux-batched-subscribe | [`0.1.6`](https://github.com/tappleby/redux-batched-subscribe/blob/24efa85565cad8c096ed484c31e529c9450978d8/package.json)        | `24efa85565cad8c096ed484c31e529c9450978d8` |
| React                   | React 18 announcement and current official teaching docs                                                                         | Documentation comparison only              |

This was a source review, not runtime execution of these libraries. Error and reentrancy results identified as deductions follow the cited control flow. The hosted Redux Toolkit `autoBatchEnhancer` page returned a transport error; its official documentation source and implementation were both accessible at the pinned commit. No required evidence remained inaccessible.

## Primary sources

- [Local Store][store]: update boundary, current batching, and persistence subscriptions.
- [Local patch application][patch]: sequential writes and failure points.
- [Local event emitter][emitter]: snapshot traversal and exception propagation.
- [Local entity base][entity] and [register][register]: immediate change events and write behavior.
- [MobX transaction][mobx-transaction], [batch depth][mobx-batch], [actions][mobx-action], and [reaction queue/error handling][mobx-reaction].
- [MobX action documentation][mobx-docs] and [low-level observation documentation][mobx-observe].
- [Solid batch documentation][solid-docs] and [client reactive source][solid-source].
- [Preact Signals core source][signals] and [batch documentation][signals-docs].
- [React state batching guide][react-batching] and [React 18 automatic batching announcement][react-18].
- [Redux subscription documentation][redux-docs] and [core Store implementation][redux-source].
- [redux-batched-subscribe implementation][redux-batched].
- [Redux Toolkit enhancer implementation][rtk-source] and [official documentation source][rtk-docs].
- [ECMAScript finally evaluation][try-finally] and [throw evaluation][throw].

[store]: ../../../packages/store/src/Store.ts
[patch]: ../../../packages/store/src/applyPatch.ts
[emitter]: ../../../packages/event-emitter/src/EventEmitter.ts
[entity]: ../../../packages/entities/src/Entity.ts
[register]: ../../../packages/entities/src/LWWRegister.ts
[mobx-transaction]: https://github.com/mobxjs/mobx/blob/ed5e082d7392466ee4507756ed71205c7d654d64/packages/mobx/src/api/transaction.ts#L10-L17
[mobx-batch]: https://github.com/mobxjs/mobx/blob/ed5e082d7392466ee4507756ed71205c7d654d64/packages/mobx/src/core/observable.ts#L107-L124
[mobx-action]: https://github.com/mobxjs/mobx/blob/ed5e082d7392466ee4507756ed71205c7d654d64/packages/mobx/src/core/action.ts#L61-L158
[mobx-reaction]: https://github.com/mobxjs/mobx/blob/ed5e082d7392466ee4507756ed71205c7d654d64/packages/mobx/src/core/reaction.ts#L192-L307
[mobx-docs]: https://mobx.js.org/actions.html
[mobx-observe]: https://mobx.js.org/intercept-and-observe.html#observe
[solid-docs]: https://docs.solidjs.com/reference/reactive-utilities/batch
[solid-source]: https://github.com/solidjs/solid/blob/b25c557754f2ced0d86490e6dbfded9b1745b663/packages/solid/src/reactive/signal.ts
[signals]: https://github.com/preactjs/signals/blob/877e461350556815a631447a3e702ad1063c43a0/packages/core/src/index.ts
[signals-docs]: https://preactjs.com/guide/v10/signals/#batchfn
[react-batching]: https://react.dev/learn/queueing-a-series-of-state-updates
[react-18]: https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching
[redux-docs]: https://redux.js.org/api/store#subscribelistener
[redux-source]: https://github.com/reduxjs/redux/blob/56abca4749921d68f40cda20afd2043af9751f72/src/createStore.ts
[redux-batched]: https://github.com/tappleby/redux-batched-subscribe/blob/24efa85565cad8c096ed484c31e529c9450978d8/src/index.js
[rtk-source]: https://github.com/reduxjs/redux-toolkit/blob/e7a8b318df28aaf50ced1e65cd4636b7508263b2/packages/toolkit/src/autoBatchEnhancer.ts
[rtk-docs]: https://github.com/reduxjs/redux-toolkit/blob/e7a8b318df28aaf50ced1e65cd4636b7508263b2/docs/api/autoBatchEnhancer.mdx
[try-finally]: https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-try-statement-runtime-semantics-evaluation
[throw]: https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html#sec-throw-statement-runtime-semantics-evaluation
