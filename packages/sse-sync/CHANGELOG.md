# @nn/sse-sync

## 3.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

### Patch Changes

- 23da839: Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
- Updated dependencies [23da839]
- Updated dependencies [23da839]
- Updated dependencies [63c2cc2]
- Updated dependencies [63c2cc2]
  - @nn/entities@3.1.0
  - @nn/guards@0.4.0
  - @nn/observable@3.1.0
  - @nn/store@3.1.0
  - @nn/sync-engine@4.1.0

## 3.0.0

### Major Changes

- bd887fa: Sync engines stop with `dispose()` instead of `detach()`, since nothing attaches them anymore.

  - `sync.detach()` becomes `sync.dispose()`, and `sync.detached` becomes `sync.disposed`.
  - `SyncState.Detached` becomes `SyncState.Disposed`, and its value changes from `"detached"` to `"disposed"`.

  Custom engines that extend `SyncEngine` call `this.session.reopen()` instead of `this.session.reconnect()` to close and open a connected transport again. It still does nothing unless the engine is connected.

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.
- Updated dependencies [bd887fa]
- Updated dependencies [8abc710]
- Updated dependencies [8abc710]
  - @nn/sync-engine@4.0.0
  - @nn/entities@3.0.1
  - @nn/guards@0.3.1
  - @nn/observable@3.0.2
  - @nn/store@3.0.1

## 2.0.0

### Major Changes

- 5d1e50e: Replace static `attach()` factories with public constructors and explicit `connect()` calls. Engines stay idle after construction, so listeners can be registered before synchronization starts. IndexedDB and Broadcast constructors keep `"nn-default"` as the default database or channel name.

  Replace `const sync = Engine.attach(store, options)` with:

  ```ts
  const sync = new Engine(store, options);

  sync.connect();
  ```

- 5d1e50e: Sync engines expose their connection lifecycle and failures directly, through `onStateChange` and `onError`, instead of `session` and `delegate`.

  - `sync.session.retry()` and `sync.session.detach()` become `sync.retry()` and `sync.detach()`. `sync.session.state`, `connected`, `disconnected` and the other state flags become `sync.state`, `sync.connected` and so on.
  - `sync.session.changes.subscribe(listener)` becomes `sync.onStateChange(listener)`.
  - `sync.delegate = { syncEngineDidFail: (engine, error) => … }` becomes `sync.onError((error) => …)`. Any number of listeners can subscribe, at any time. With none, failures are dropped.
  - `SessionState` is exported as `SyncState`, and `SyncEngineDelegate` is removed.

  Custom engines that extend `SyncEngine` still drive `this.session`, which is now protected. They report failures with `this.errors.notify(error)` instead of `this.delegate?.syncEngineDidFail(this, error)`.

### Patch Changes

- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
  - @nn/sync-engine@3.0.0
  - @nn/observable@3.0.1
  - @nn/store@3.0.0

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
