---
author: Petr Chalupa
date: 2026-11-07
---

# ADR-18: Expose the store and sync engines through listener methods

Amends [ADR-12](ADR-12-report-changes-to-a-single-delegate.md), [ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md), [ADR-16](ADR-16-give-sync-engines-a-connection-lifecycle.md) and [ADR-17](ADR-17-retry-disconnected-engines-on-wake-signals.md).

## Context

The [Node example](../../apps/example-node/src/index.ts) is the first app that drives a store and an engine without React. Writing it showed how much of the internals the public API leaks. It writes through `store.state.update(...)`, listens with `sseSync.session.changes.subscribe(...)`, reads `sseSync.session.disconnected`, and handles failures by assigning `sseSync.delegate = { syncEngineDidFail }`.

That exposes three internal layers. [`State`](../../packages/store/src/state.ts) and [`Session`](../../packages/sync-engine/src/session.ts) are implementation details that every caller has to reach through. The delegate slot from ADR-12 is a pattern most JavaScript developers don't know, and it holds one handler. A React component that wants to show a "sync failed" banner can't reach it, because the engine is attached once in a module.

`Store` also had two channels. `store.changes` passed the changed [`Entity`](../../packages/entities/src/entity.ts) set to engines, and `store.updates` notified React with no arguments. `Entity` was public through `changes` and through `State.merge`, which took a decoded entity. Each engine encoded the changed entities on its own, so an app with three engines encoded every change three times.

## Decision

We will expose every consumer-facing listener as an `on<Event>(listener)` method that returns its unsubscribe function.

[`Store`](../../packages/store/src/store.ts) exposes `read()`, `update(recipe)`, `encode()`, `merge(name, value)` and `onChange(listener)`. It keeps its `State` in a private field and forwards calls to it. `State` stays a separate class for now, because it needs a cleanup before it can be folded in. `changes`, `updates` and the `state` property are removed.

The store speaks only encoded data at its boundary. `onChange` calls its listeners once per commit that changed something, with the changed top-level fields keyed by name and already encoded. React ignores the argument. Engines push the entries as they are. `merge(name, value)` takes encoded data, decodes it with the store's own `Codec`, and throws when the value can't be decoded. `Entity` no longer appears in any public signature of `Store` or [`SyncEngine`](../../packages/sync-engine/src/sync-engine.ts).

`SyncEngine` exposes its lifecycle directly. It has the getters `state`, `idle`, `connecting`, `connected`, `disconnected` and `detached`, the methods `retry()` and `detach()`, and the listeners `onStateChange` and `onError`. `onStateChange` keeps the semantics of ADR-17's `session.changes`. `onError` receives every failure the engine reports: a failed connection attempt, a rejected push and a stream error. With no listener, errors are dropped. `session` becomes protected, so subclasses still call `connect`, `reconnect` and `drop`, and they report failures with `this.errors.notify(error)` on the protected `errors` observable. `@nn/sync-engine` exports the state enum as `SyncState`. The public `delegate` and `SyncEngineDelegate` are removed.

Internal delegates stay as ADR-12 describes them: entities, `State` to `Store`, `Session` to `SyncEngine`, [`EventStream`](../../packages/sse-sync/src/event-stream.ts) and [`IndexDb`](../../packages/indexdb-sync/src/index-db.ts). No consumer touches them.

## Alternatives considered

We considered renaming the two store channels to `onUpdate` for apps and `onChange` for engines, with `onChange` still passing the changed entities. It costs nothing in speed, but it keeps `Entity` in the public API, which is what we wanted out.

We considered an `onChange` with no payload, where the engine compares each field's `revision` with the one it last pushed. The app surface would be the narrowest. But to push a changed field, the engine needs its encoded value. That means either encoding the whole store once per engine per commit, which is slow with 10,000-row collections, or adding a per-field accessor such as `store.field(name)` that hands out the entity again.

We considered passing only the changed field names and adding `store.encode(name)`. `Entity` stays private there too, but every engine encodes the same fields separately, and `encode` gains an overload.

For engine listeners, we considered a single `subscribe(listener)` with tagged events, which forces every listener to filter on the event type in its body. We considered `subscribe("error", fn)` in the style of `addEventListener`. We also considered one `subscribe({ state, error })` call, which looks like RxJS's `{ next, error }` and suggests that an error ends the stream. Separate `on…` methods are typed per event and follow the same rule as `store.onChange`.

## Consequences

Apps write `store.update(...)`, `sync.onError(...)`, `sync.onStateChange(...)` and `sync.retry()`. Any part of an app can listen for failures at any time. A listener registered after `attach()` still misses the first `connecting` transition, because `attach()` starts connecting synchronously. Apps read `sync.state` for the current value.

The payload encodes each changed field the first time a listener reads it, and every engine shares that result. A store with only React listening, or with every engine disconnected, encodes nothing, as before. A listener that keeps the payload and reads it later gets the field as it is at that later moment.

Apps and engines now share one channel, so `Observable.notify` calls every observer even when one throws, then rethrows the first error. A bug in an app's `onChange` listener can't stop an engine from pushing the edit, and `store.update()` still throws that error to its caller after the commit.

A merge from a remote still fires `onChange`, so engines push the merged field back. The CRDT merge makes the echo harmless, as it was with `changes`.

This is a breaking change for `@nn/store`, `@nn/sync-engine`, `@nn/sse-sync`, `@nn/indexdb-sync`, `@nn/broadcast-sync` and `@nn/react`, whose `createStore` returns the changed `Store`. Third-party engines replace `this.delegate?.syncEngineDidFail(this, error)` with `this.errors.notify(error)` and import `SyncState` instead of `SessionState`.

Folding `State` into `Store` is still open, and it will follow the `State` cleanup. Because `State` is private now, that change won't affect consumers.
