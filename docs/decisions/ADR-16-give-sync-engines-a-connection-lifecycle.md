---
author: Petr Chalupa
date: 2026-11-04
---

# ADR-16: Give sync engines a connection lifecycle

Amends [ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md) and [ADR-14](ADR-14-ship-indexeddb-persistence-as-one-sync-engine.md).

## Context

[ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md) made `SyncEngine.attach()` a single attempt. If `open()` or `pull()` failed, the engine detached itself and the error was swallowed. The engine subscribed to `store.changes` only after `open()` resolved, so an edit made while `open()` was pending was never pushed. A failed push was reported and dropped. `detach()` during `open()` didn't stop the attach, which then subscribed and pushed to a closed transport. A transport that closed itself, such as IndexedDB on `onversionchange`, had no way to tell the engine, so every later push threw.

That is not enough for a remote engine. A server drops connections, and the app has to learn about it instead of pushing into a dead transport. An edit made while the transport opens has to reach it, and a failure has to be reported instead of swallowed. The first remote engine, `SseSync`, is being built on its own branch, and it needs these rules from the base class instead of handling them in the transport.

Each top-level field of a store is one entity, and entities are state-based CRDTs that merge whole. Pushing a field's current value is always safe, and it makes earlier pushes of that field redundant. The example server stores each pushed field as it arrives and doesn't merge, so a client that merges a pull and ends up with something new has to push the result back.

## Decision

We will give `SyncEngine` a connection lifecycle that every engine follows. An engine makes one connection attempt per `attach()`. The lifecycle has five states: `idle`, `connecting`, `connected`, `disconnected` and `detached`. Every rule lives in one pure static method, `Connection.transition(state, event)`, in [`connection.ts`](../../packages/sync-engine/src/connection.ts). A failed attempt or a lost connection ends in `disconnected`, and only `detach()` leaves it. `disconnected` and `detached` ignore `succeed` and `fail`, so a late result of the attempt can't change anything. `detached` is final.

A small `Connection` class in the same file holds the current state and a queue of events, and owns the lifecycle mechanics: the attempt's `AbortController`. It handles one event at a time. An event sent while a transition's effects run, including from inside a delegate method, is queued until they finish. It tells its delegate what to do through intent-level methods: `connectionWillConnect`, `connectionDidConnect`, `connectionDidClose` and `connectionDidFail`. The delegate is passed to the constructor and can't be replaced. `SyncEngine` creates its `Connection` with itself as the delegate and implements these methods with sync work only.

On each transition, `Connection` runs the effects of leaving the old state, then those of entering the new one:

- **Entering `connecting`:** `Connection` creates a new `AbortController` and calls `connectionWillConnect(signal)`. The engine calls `open(signal)`, then pulls every field and merges it into the store. `Connection` sends `succeed` when that resolves and `fail` with the rejection reason when it rejects.
- **Entering `connected`:** `Connection` calls `connectionDidConnect`. The engine pushes every field. Nothing survives a reload, so the connection pushes every field. This covers edits made while the transport opened and a merge result that the server has to see. Then the engine subscribes to `store.changes`.
- **Entering `disconnected`:** Nothing reconnects. The `fail` event carries the error, from the rejected attempt or from `connection.lost(error)`, and `Connection` passes it to `connectionDidFail` after `connectionDidClose`. The engine reports it through `syncEngineDidFail`. A `fail` that changes nothing, such as a late rejection after `detach()` or a second `lost(error)`, isn't reported.
- **Leaving `connecting` or `connected` for anything but `connected`:** `Connection` aborts the attempt's signal and calls `connectionDidClose`. The engine unsubscribes from `store.changes` and calls `close()`, once after `open()`.

Pushing follows the CRDT property. Each change pushes the changed field right away, even while an earlier push of the same field is pending, and a connection pushes each field from the new `State.encode()` snapshot. A rejected push is reported to the delegate and skipped, and the engine stays connected. The field goes out again on its next change. Store changes are pushed only while connected, because the engine is subscribed to `store.changes` only then. A push still pending when its connection ends isn't cancelled, and if it then fails, that failure is reported like any other.

The engine surface changes in these ways:

- `syncEngineDidFail` replaces `syncEngineDidFailToPush`. It reports a failed connection attempt, a lost connection and a rejected push, so no failure is swallowed.
- `open(signal)` receives the attempt's `AbortSignal`. `push(name, entry)` doesn't.
- `attach()` returns nothing and connects in the background. `IndexDbSync.attach(store)` and `BroadcastSync.attach(store)` return the engine right away instead of a promise. The store shows its default values until the stored state merges in, and React renders again when it does. Entities are CRDTs, so an edit made in the meantime merges with the stored state instead of being overwritten, and the connection pushes it.
- `detach()` is final, can be called repeatedly, and cancels an attempt in progress.
- A subclass reports that its transport dropped with `this.connection.lost(error)`, which does nothing unless the engine is connecting or connected. `SyncEngine` has no `lost` method of its own.
- `sync.connection` is public. Other code, including another engine, reads `connection.state` and drives the lifecycle with `connection.attach()`, `connection.lost(error)` and `connection.detach()`. `ConnectionState` is exported from `@nn/sync-engine`. Because the engine subscribes to `store.changes` on connecting instead of in `attach()`, `connection.attach()` syncs the same as the engine's own `attach()`. The error passed to `connection.lost(error)` reaches `syncEngineDidFail` whoever calls it.

Recovery is out of scope for now. A failed attempt or a lost connection leaves the engine disconnected until `detach()`. To sync again, the app reloads or attaches a new engine, which starts over and pushes every field.

[`IndexDb`](../../packages/indexdb-sync/src/index-db.ts) reports `indexDbDidChangeVersion` to its delegate when `onversionchange` closes the database. An explicit `close()` does not report a version change. [`IndexDbSync`](../../packages/indexdb-sync/src/index-db-sync.ts) calls `connection.lost(error)`, so the failure is reported and the engine stops syncing. [`BroadcastSync`](../../packages/broadcast-sync/src/broadcast-sync.ts) needs no change, and pushing every field on connection announces a new tab's state to the other tabs.

This amends two points. ADR-13 says a failed `open()` detaches the engine and a failed push is dropped without notice, and that a remote engine would probably need a queue and a delegate. Failures are now reported, a failed connection leaves the engine disconnected instead of detached, and the connection pushes every field instead of queuing writes. ADR-14 describes the engine lifecycle as `open()` and `close()` around one attach. That still holds: an engine opens at most once.

## Alternatives considered

**Keep the rules inside `SyncEngine`.** A private `state` field and a private `dispatch(event)` would call `transition()` and run the effects inline. It has fewer parts. We rejected it because the event queue and the effects would grow `SyncEngine` and couldn't be tested apart from it. With `Connection` separate, the table of transitions, the queueing and the delegate are tested without a transport, the way `Store` and `State` are.

**Use XState.** It is a known state machine library. We rejected it because five states and five events don't justify a new dependency in a library that is otherwise small, and `Connection` is a few dozen lines.

**Put the state machine in a shared package.** A `@nn/state-machine` package could serve other code later. We rejected it because the connection lifecycle would be its only user. If a second one appears, we can extract it then.

**Keep `connection` private and add engine methods.** The engine could forward `state` and a `syncEngineDidChangeState` delegate method. We rejected it because forwarding every lifecycle method would duplicate `Connection` on `SyncEngine`.

**Keep a persisted outbox of pending writes.** It would send only what changed while offline. We rejected it because pushing every field on connection reaches the same result without storing anything, and it also covers edits made before a reload. The cost is more traffic on each connection.

**Retry failed and lost connections automatically.** A fixed delay, or as soon as the browser fires `online`, with each attempt numbered so late results of an earlier one are ignored. It would recover without the app doing anything. We dropped it for now because it adds a timer, a global listener and attempt numbers to every engine, keeps a Node process alive until `detach()`, and has every client hit a server that is down on a fixed schedule. One attempt per `attach()` is simpler to reason about and test. Retrying can be added later in `Connection` without changing the engine's public surface.

**Let `attach()` resolve when the attempt settles.** `await IndexDbSync.attach(store)` would mean that the stored state has loaded or loading has failed, and tests could wait on it. We rejected it because `Connection` would have to keep the attempt's resolver and settle it on the right transitions, including on `detach()` while `connectionWillConnect` ignores the abort signal. The CRDT merge makes waiting unnecessary for correctness, the example app already attaches without awaiting, and [ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md) rejected a `restored` promise for the same reasons. An app that needs to know when the stored state has loaded can get a delegate method later.

**Detach after a failed connection, as ADR-13 did.** We rejected it because the failure would stay invisible. Staying in `disconnected` reports the error and keeps `detach()` the single way out.

## Consequences

This is a breaking change for `@nn/sync-engine`, `@nn/indexdb-sync` and `@nn/broadcast-sync`, and each gets a major changeset. Code that implements `syncEngineDidFailToPush` renames it to `syncEngineDidFail`. Code that awaits `IndexDbSync.attach()` or `BroadcastSync.attach()` drops the `await`, and a subclass's static factory calls `attach()` without awaiting it. A subclass that doesn't use the signal still compiles. `@nn/store` gets a minor release for `State.encode()`.

Pushes of one field aren't serialized. A transport that cancels a pending write when a newer one for the same field starts, as `IndexDb` does, rejects the older push, and the engine reports that rejection through `syncEngineDidFail` although the newer write carries the data. Against a server that doesn't merge, two pushes of one field can also arrive out of order, leaving the older value stored until the field changes again. Serializing pushes per field would close both and is left for later.

An engine doesn't recover on its own. After a failed attempt or a lost connection it stays disconnected, and edits stay local until the app reloads or attaches a new engine. An app that wants to recover listens to `syncEngineDidFail`, detaches the engine and attaches a new one. `Connection` doesn't notify observers of its transitions, because nothing outside the engine needs them yet. An observable channel can be added later without a breaking change.

An app's `syncEngineDidFail` should not throw. A throw from a failed `push` surfaces as an unhandled rejection, a throw while reporting a failed `open` or `pull` surfaces as an unhandled rejection after the engine has disconnected, and a throw on the `connection.lost(error)` path reaches its caller synchronously, which for `IndexDbSync` is the `onversionchange` handler. The throw doesn't change the connection state.

The connection pushes every field. With a server that doesn't merge, a narrow race remains. Another client's push that lands between this client's pull and its push is overwritten on the server, and the other client doesn't push again, because merging the overwritten value doesn't change its state. The data reaches the server on that client's next change or when it attaches a new engine. A cancelled push whose request already left can overwrite a newer value the same way. A server-side merge would close both.

`Connection` is part of the public surface of `@nn/sync-engine`, so changing its states, events or methods is a breaking change. Outside code can call `connection.detach()` or `connection.lost(error)` and end an engine's sync without the engine's subclass knowing why. A lost connection is still reported through `syncEngineDidFail` with the caller's error.

`SseSync` adapts to this lifecycle on its own branch. A stream error after the snapshot becomes a call to `this.connection.lost(error)`, which reports it and leaves the engine disconnected. Its own notes that a failed bootstrap detaches for good need updating there: the engine now reports the failure and stays disconnected until it's detached.

Bluetooth and a handshake that hands an existing tab's state to a new `BroadcastSync` tab are out of scope.
