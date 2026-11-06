# @nn/sse-sync

## 1.1.0

### Minor Changes

- 00486d7: When the browser closes the event stream for good, for example after a proxy answers with a 502, the engine disconnects instead of reopening after three seconds, and stays disconnected until the app calls `session.retry()`. A server that is down no longer receives a retry from every client on a fixed schedule.

  The engine doesn't listen for the store or browser events, so it runs unchanged in Node. To recover, call `session.retry()` from the signals your runtime has, such as an edit, the network coming back, or the user returning:

  ```ts
  const sync = SseSync.attach(store, url);

  store.changes.subscribe(() => sync.session.retry());
  addEventListener("online", () => sync.session.retry());
  document.addEventListener("visibilitychange", () => {
  	if (document.visibilityState === "visible") sync.session.retry();
  });
  ```

  `session.retry()` does nothing unless the engine is disconnected. A failed first connection, such as a stream refused before its first event or a first event that can't be read, is retried the same way. Every retry merges a fresh snapshot and pushes every field, so edits made while disconnected reach the server.

### Patch Changes

- Updated dependencies [00486d7]
  - @nn/sync-engine@2.1.0

## 1.0.0

### Major Changes

- dbd5b8a: Adds `SseSync`, a sync engine that keeps a store in sync with a server over [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events). The server exposes `GET /subscribe`, an event stream whose first event holds every stored field and whose later events hold the fields each push changed, and `POST /push`, which takes the changed fields. Every event's `data` is a JSON object of encoded fields.

  Attach it with `SseSync.attach(store, url)`, where `url` is a `URL`. It returns the engine right away and connects in the background: the engine opens the event stream, merges the first event into the store, pushes every field, and then pushes each field that changes. Edits made before the first event arrives are pushed once it does. Each later event is merged as it arrives, and a reconnect brings a fresh snapshot. If the browser closes the stream for good, for example after an error response on reconnect, the engine reconnects after three seconds and pushes every field again. Call `sync.session.detach()` to stop syncing and close the stream.

  ```ts
  import { IndexDbSync } from "@nn/indexdb-sync";
  import { SseSync } from "@nn/sse-sync";

  IndexDbSync.attach(store);
  SseSync.attach(store, new URL("https://example.com/api"));
  ```

  Endpoints resolve under the URL's path, so `https://example.com/api` subscribes to `https://example.com/api/subscribe`.

  While the browser retries the stream before the first event, the engine keeps waiting. If the browser closes the stream before the first event, or the first event isn't a JSON object of encoded fields, the failure is reported to `delegate.syncEngineDidFail`, the engine disconnects, and the store keeps working locally.

  `SseSync` doesn't queue writes. A failed push is reported to `delegate.syncEngineDidFail` and dropped, so an edit made while the server is unreachable reaches it when that field changes again or the engine reconnects. The server is expected to store each field as it arrives; merging happens in the clients.

### Patch Changes

- Updated dependencies [dbd5b8a]
- Updated dependencies [dbd5b8a]
- Updated dependencies [dbd5b8a]
- Updated dependencies [a36eeaf]
- Updated dependencies [a36eeaf]
- Updated dependencies [dbd5b8a]
  - @nn/guards@0.3.0
  - @nn/store@2.1.0
  - @nn/sync-engine@2.0.0
