---
author: Petr Chalupa
date: 2026-11-04
---

# ADR-15: Stream remote changes over server-sent events

Amended by [ADR-17](ADR-17-retry-disconnected-engines-on-wake-signals.md): when the browser closes the stream for good, `SseSync` disconnects and waits for the app to call `session.retry()`, instead of reopening after three seconds.

## Context

[ADR-13](ADR-13-attach-persistence-and-sync-from-outside-the-store.md) moved persistence and sync out of `Store` into engines that extend [`SyncEngine`](../../packages/sync-engine/src/sync-engine.ts), and said a remote engine would follow. It also kept `Repository` and `Remote` as separate interfaces, and expected the remote engine to sit on `Remote` the way `RepositorySync` sat on `Repository`. [ADR-14](ADR-14-ship-indexeddb-persistence-as-one-sync-engine.md) has since folded `Repository` into `@nn/indexdb-sync`.

`Remote` had one implementation, `HttpRemote`, and no users since ADR-13 took it out of `Store`. [`BroadcastSync`](../../packages/broadcast-sync/src/broadcast-sync.ts), the second engine, owns its `BroadcastChannel` directly and has no transport interface underneath it.

The example server announced each push on a [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) stream with a bare `update` message, and a client then fetched every stored field from `GET /sync/pull`. Each update cost a second round trip, and a client had to pull again whenever the stream reconnected, or it would miss what changed while the stream was down.

## Decision

We will add [`SseSync`](../../packages/sse-sync/src/sse-sync.ts) in `@nn/sse-sync`. It opens an `EventSource` on `GET /subscribe` and calls `fetch` for `POST /push` itself, the way `BroadcastSync` owns its channel. Endpoints resolve under the base URL's path.

The event stream carries the data. Every event's `data` is a JSON object of encoded fields. On each connect the server sends every stored field as the first event, and then one event per push with the fields that push changed. The engine's `open()` waits for that first event, the bootstrap reads each field from it, and every later event is passed to `receive()`. Because a reconnect gets a fresh snapshot, the engine needs no reconnect logic of its own. The server registers a client for updates before it reads the snapshot, so an update that lands in between arrives just before a snapshot that already contains it. `GET /pull` is removed.

We will delete `@nn/remote` and `@nn/http-remote`. They were never published, so nothing outside the repository depends on them. This supersedes ADR-13's decision to keep `Remote` as an interface, as ADR-14 did for `Repository`.

## Alternatives considered

**Announce updates on the stream and pull them over HTTP.** This was the first version of the engine, `HttpSync`. The stream stays a plain notification and the server needs no event format. We rejected it because every update needs a second round trip, and the engine has to pull again on every reconnect to cover what it missed.

**Resume with `Last-Event-ID` instead of resending the snapshot.** The server would number its events and replay what a client missed, which saves traffic on reconnect. We rejected it because the server stores only current values, not a history of updates, and it would still need the full snapshot when its history doesn't reach back far enough.

**A `RemoteSync` engine on the `Remote` interface, with `HttpRemote` passed in.** It mirrors the `Repository` and `RepositorySync` split that ADR-13 described. We rejected it because the interface would have one implementation and adds a layer between the engine and the only transport it talks to.

## Consequences

`SseSync` has no queue of pending writes. A failed push is reported to `syncEngineDidFail` and dropped, so an edit made while the server is unreachable reaches it when that field changes again or the engine reconnects, because connecting pushes every field. A stream error is left to `EventSource`, which reconnects on its own, and the engine keeps waiting for the first event meanwhile. If the browser gives up on the stream before the first event, or that event can't be read, the failure is reported and the engine disconnects; the store keeps working locally. When the browser gives up on the stream after the first event, for example after a proxy answers a reconnect with a 502, the engine reconnects through `session.reconnect()` after three seconds, merges the new snapshot and pushes every field again. A later event that can't be parsed or decoded is ignored.

Every reconnect sends the whole snapshot. That is fine for the example server's data, and a server with larger data would need resume support.

If a server accepts the stream but never sends the first event, the engine stays connecting and doesn't push. The store keeps working locally.

The example server stores each field as it arrives and doesn't merge. Clients converge because each one merges what it receives and pushes its own changes again. A client also receives the event for its own push; merging is idempotent, so nothing is pushed in return. The test-only `POST /reset` doesn't send an event, because an empty object changes nothing in a client that merges it.

A WebSocket engine would carry pushes and updates on one connection. It will be a separate engine package when we build it; this decision doesn't share a message format with it in advance.
