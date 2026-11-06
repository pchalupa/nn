---
"@nn/sse-sync": minor
---

When the browser closes the event stream for good, for example after a proxy answers with a 502, the engine disconnects instead of reopening after three seconds. It connects again when the store changes, or when the app calls `session.retry()`. A server that is down no longer receives a retry from every client on a fixed schedule.

The engine doesn't listen for browser events, so it runs unchanged in Node. To also recover when the network or the user comes back, call `session.retry()` from the signals your runtime has:

```ts
const sync = SseSync.attach(store, url);

addEventListener("online", () => sync.session.retry());
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") sync.session.retry();
});
```

`session.retry()` does nothing unless the engine is disconnected. A failed first connection, such as a stream refused before its first event or a first event that can't be read, is retried the same way. Every retry merges a fresh snapshot and pushes every field, so edits made while disconnected reach the server.
