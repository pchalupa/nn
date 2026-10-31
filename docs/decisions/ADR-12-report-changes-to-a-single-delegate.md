---
author: Petr Chalupa
date: 2026-10-31
---

# ADR-12: Report changes to a single delegate

## Context

[`EventEmitter`](../../packages/event-emitter/src/EventEmitter.ts) supports many named events, each with many listeners. Every production use in nn has one event and one known consumer. Each [`Entity`](../../packages/entities/src/Entity.ts) owned an emitter whose only listener was its parent [`LWWMap`](../../packages/entities/src/LWWMap.ts) or [`RGA`](../../packages/entities/src/RGA.ts), or [`State`](../../packages/store/src/State.ts) for a top-level field. `State` had one internal listener, [`Store`](../../packages/store/src/Store.ts), which persists the changed entries. [`HttpRemote`](../../packages/http-remote/src/HttpRemote.ts) had an `update` event with no listener at all.

That shape cost one `Map` and one `Set` per entity, a closure per child, and a map of unsubscribe functions in every container. Each class also wrapped `on` and `off` in its own `subscribe`. The code read as if anyone might be listening when the consumer was always one known owner.

Some observers really are many and come and go. React components subscribe through [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore), which needs a `subscribe(listener)` function that returns an unsubscribe function. It reads the snapshot as soon as the listener fires, so the new state must already be readable at that point.

Restoring from the repository merges a freshly decoded tree into the live one through `Store.restore`, `State.merge` and `RGA.merge`. `RGA.merge` keeps the incoming row objects for keys it doesn't have yet, and those rows already belong to the decoded `RGA`.

Apple's frameworks split the same problem the same way. A delegate serves the one owner that coordinates with an object, and a notification serves any number of observers. The [research note](../notes/research/swift-delegates-and-observation.md) has the details and sources.

## Decision

We will report changes to a single delegate wherever a producer has one structural consumer. We'll keep a listener set only where many observers come and go.

A class that reports to a delegate implements `Observable<Delegate>` from [`Observable.ts`](../../packages/event-emitter/src/Observable.ts), which is just a `delegate?: Delegate` slot. Each delegate interface lives next to the class that calls it and has exactly one method:

- `EntityDelegate.entityDidChange(entity, child?)` in `@nn/entities`. `entity` is the sender. `child` is the direct child whose change caused this one, or `undefined` when the entity changed itself.
- `StateDelegate.stateDidChange(state, changed)` in `@nn/store`. `changed` holds the names of the changed top-level fields.
- `RemoteDelegate.remoteDidUpdate(remote)` in `@nn/remote`.

Every call means "did change": the sender passes itself first, and the new value is already readable when the call arrives. We don't use will-change calls.

Assigning a delegate replaces the previous one, and assigning `undefined` detaches it. The setter never throws. `LWWMap` and `RGA` set themselves as the delegate of every child they add, and set the old child's delegate to `undefined` when they remove or replace it. When `RGA.merge` keeps an incoming row for a new key, the merging `RGA` takes that row over by assigning itself as its delegate.

`State` is the delegate of the root map. It maps each top-level field entity to its name, so it can turn `entityDidChange(root, child)` into a field name. It throws a `TypeError` if a change arrives without a known field. `State` batches as described in [ADR-05](ADR-05-batch-store-notifications.md), then calls `stateDidChange`. `Store` is that delegate. It starts persisting each changed entry and then calls its listeners. The listeners are a plain `Set<() => void>` behind `Store.subscribe(listener)`, which `@nn/react` uses.

`Remote` exposes `connect()`, which opens the connection and returns the function that closes it. Each update goes to the delegate.

## Alternatives considered

**Keep an event emitter on every producer.** It supports observers we might add later without an API change. We rejected it because no such observer exists for entities, `State` or remotes. Meanwhile, every entity pays for the emitter's allocations and every container keeps unsubscribe bookkeeping.

**A single callback field, such as `entity.onChange = (child) => {}`.** This is slightly plainer than an object with a method. We rejected it because a named interface tells the reader what the consumer is. `Observable<Delegate>` also gives one shared way to mark the classes that report.

**Strict single ownership, where a second, different delegate throws.** This catches an entity that has silently moved to another parent. We rejected it because `RGA.merge` and restoring from the repository take over rows that the decoded tree owns, so the rule throws on every start with saved list rows. Making those paths work would need either a special path that moves ownership or a copy of every merged row. Both add the kind of ceremony we wanted to remove. We kept UIKit's "last assignment wins" behavior instead.

**Will-change timing, like Combine's `objectWillChange`.** It lets an observer read the old value before the change. We rejected it because `useSyncExternalStore` and the revision cache in [`View`](../../packages/store/src/View.ts) both read the new value as soon as the call arrives.

**A weak reference to the delegate, as Swift's `weak var delegate` does.** In Swift this breaks retain cycles. JavaScript's garbage collector already frees parent and child cycles, and a [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef) would make delivery depend on when collection runs. We hold the delegate strongly and detach explicitly.

## Consequences

The public API changes in five packages. `Entity.subscribe` and `state.subscribe` are gone, `Remote.subscribe()` is now `connect()`, and `HttpRemote.events` is gone. Code that observed an entity or `State` directly now assigns a delegate, or subscribes through `Store`. Each change has its own changeset.

An entity or `State` can have only one consumer. A second observer replaces the first without any error. `store.state` is public, so assigning `store.state.delegate` disconnects `Store`, which stops both persistence and React updates. If a second consumer is ever needed, it gets a listener set on `Store` or a new delegate, not a second slot.

Detaching doesn't check who currently owns a child. If a row is ever shared between two live trees, removing it from the old parent would cut it off from the new one. No current path does this, because the only shared rows sit in a decoded tree that is thrown away after the merge. Sync will merge live trees, so it should add the guard `if (item.delegate === this)` before detaching.

Entities no longer allocate an emitter, and containers no longer keep unsubscribe maps. On 2026-10-31, `Store.bench.ts` measured 11–14% more throughput for nested updates at 100 and 10,000 rows. Tests now assert through a recording delegate, for example `{ entityDidChange: vi.fn() }`, which also checks the `child` argument.

`EventEmitter` stays exported from `@nn/event-emitter`, although nothing in the repo uses it now. The `Entity.subscribe` and Store-emitter mechanics described in ADR-05 and ADR-08 are replaced by this record. Their decisions about batching and single notifications still apply.
