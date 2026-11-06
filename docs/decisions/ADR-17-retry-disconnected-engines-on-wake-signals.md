---
author: Petr Chalupa
date: 2026-11-06
---

# ADR-17: Retry disconnected engines on wake signals

Amends [ADR-15](ADR-15-stream-remote-changes-over-server-sent-events.md) and [ADR-16](ADR-16-give-sync-engines-a-connection-lifecycle.md).

## Context

[ADR-16](ADR-16-give-sync-engines-a-connection-lifecycle.md) made `disconnected` a state that only `detach()` leaves, and deferred automatic retry. It noted that retrying could be added to `Session` later without changing the engine's public surface.

[ADR-15](ADR-15-stream-remote-changes-over-server-sent-events.md) left stream errors to [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource), which retries network failures on its own. It closes the stream for good only when the server or a proxy answers with an error status or the wrong content type. For that case, `SseSync` called `session.reconnect()` after a fixed three-second `setTimeout`. The delay was a guess. Every client retried a server that was down on the same schedule, `close()` had to clear the timer, and the tests needed fake timers. A failed first connection, such as a stream refused before its first event, wasn't retried at all.

`SseSync` runs in browsers and in Node programs. Signals that the server may be reachable again differ between them: a browser has `online` and page visibility, and a Node program has neither. Every connection pushes every field, so an engine that connects again converges without a queue of pending writes.

## Decision

We will let a session leave `disconnected` with a new `retry` event. Engines don't send it themselves. Apps send it from whatever signals they have.

[`Session`](../../packages/sync-engine/src/session.ts) gets `SessionEvent.Retry` and `retry()`. `disconnected` plus `retry` goes to `connecting`, and every other state ignores `retry`. The attempt runs the usual effects: open, pull, then push every field once connected. `reconnect` keeps its meaning and still applies only to `connected`.

`Session` also gets `changes`, an [`Observable`](../../packages/observable/src/observable.ts) that notifies with the new state once per transition, after that transition's effects have run. It doesn't deliver the current state on subscribe. An event sent from an observer is queued like one sent from a delegate method, and observers must not throw. `SessionState` is exported from `@nn/sync-engine`.

[`SseSync`](../../packages/sse-sync/src/sse-sync.ts) calls `session.drop()` when the browser closes the stream for good, and waits there. It references no browser globals, uses no timer, and doesn't watch the store.

An app that wants to recover calls `sync.session.retry()` itself. The [example app](../../apps/example-react/src/store.ts) calls it when the store changes, on `online`, and when the tab becomes visible. While the engine is connecting or connected, the transition table ignores those calls. `session` stays public, as the code has had it since ADR-16 landed. ADR-16 says it is protected; the code is right and that text is stale.

## Alternatives considered

**Keep a fixed delay, or back off with jitter.** It recovers without any signal, including a tab that's only being watched. We rejected it because the timer is what we wanted to remove: it keeps a Node process alive until `detach()`, needs fake timers in tests, and still retries a server that is down on a schedule. An app that needs recovery without a signal can call `session.retry()` from its own clock.

**Listen for `online` and page visibility inside `SseSync`.** Browser apps would get recovery without wiring anything. We rejected it because the package also runs in Node, where those signals don't exist. Checking for them at runtime hides that from Node programs, and referencing `document` ties a cross-runtime package's source to the DOM type library.

**Retry on store changes inside `SseSync`.** Apps would recover on the next edit without wiring anything. We rejected it because it is a policy like `online` or visibility, and building in one signal splits the policy between the package and the app. `store.changes` also fires for merges from other engines, such as `BroadcastSync` delivering another tab's edit, so one engine's traffic would restart another's connection without the app seeing why. The subscription has to outlive every connection and be removed on detach, which adds lifecycle code to the engine. An app gets the same behavior from one line.

**Inject wake signals as an `Observable` option on `attach()`.** It keeps the policy declarative. We rejected it because `session.retry()` already does the same job without a new option, and an app needs only a few lines either way.

**Add `retry()` to `SyncEngine`.** Apps would not depend on `session`. We rejected it because `session` is already how apps call `detach()`, and a second entry point would be one more surface to keep in step.

**Retry every engine on store changes in `SyncEngine`.** It would give `IndexDbSync` and `BroadcastSync` the same recovery. We rejected it because `IndexDbSync` drops on purpose when its database is deleted, and an edit would then create the database again.

## Consequences

Without wiring from the app, an engine that the server refuses stays disconnected until `detach()`. Local data is kept, but nothing syncs and nothing retries. We accept that, because `EventSource` still retries network failures on its own, and only a server answering with an error leaves the engine disconnected. Every retry pushes every field, so edits made while disconnected reach the server. Browser apps wire the store, `online` and visibility as the example app does, and can watch `session.changes` for `disconnected`. A Node program decides its own policy, as the Node client design already says. The in-progress readiness and example-agent work reads `engine.session.state` and subscribes to `engine.session.changes`; there is no `status` getter on `SyncEngine`.

A server that keeps refusing the stream, or keeps sending a first event the engine can't read, costs at most one attempt per signal. Each failed attempt is still reported through `syncEngineDidFail`. A stream closed for good isn't reported, as ADR-16 says for lost connections.

An app that retries on `store.changes` must not also write into the synced store from a `session.changes` observer when the engine disconnects. Against a server that keeps refusing, each write would trigger an attempt whose failure triggers the next write, which turns into a retry loop.

`IndexDbSync` and `BroadcastSync` don't send `retry`, so their behavior is unchanged unless an app calls `session.retry()` on them. Adding `retry` and `changes` is a minor release for `@nn/sync-engine`. Dropping the fixed-delay reopen is a minor release for `@nn/sse-sync`.
