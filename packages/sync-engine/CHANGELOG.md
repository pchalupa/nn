# @nn/sync-engine

## 4.1.1

### Patch Changes

- Updated dependencies [be7c2b2]
- Updated dependencies [be7c2b2]
  - @nn/store@3.1.2
  - @nn/entities@4.0.0

## 4.1.0

### Minor Changes

- 23da839: Ship compiled ES modules with type declarations and source maps from `dist`, so the package works without compiling TypeScript from `node_modules`.

  Import paths stay the same.

### Patch Changes

- 23da839: Depend on other `@nn/*` packages through caret ranges instead of exact versions, so compatible releases share one installed copy instead of duplicating it.
- 63c2cc2: Document the order in which a sync engine calls `open`, `pull` and `push`, how it handles errors, and which built-in engines to use as examples, in the package README.
- Updated dependencies [23da839]
- Updated dependencies [23da839]
- Updated dependencies [63c2cc2]
  - @nn/entities@3.1.0
  - @nn/observable@3.1.0
  - @nn/store@3.1.0

## 4.0.0

### Major Changes

- bd887fa: Sync engines stop with `dispose()` instead of `detach()`, since nothing attaches them anymore.

  - `sync.detach()` becomes `sync.dispose()`, and `sync.detached` becomes `sync.disposed`.
  - `SyncState.Detached` becomes `SyncState.Disposed`, and its value changes from `"detached"` to `"disposed"`.

  Custom engines that extend `SyncEngine` call `this.session.reopen()` instead of `this.session.reconnect()` to close and open a connected transport again. It still does nothing unless the engine is connected.

### Patch Changes

- 8abc710: Point `homepage` and `repository` to each package's own directory, so npm links open the right README and source.
- 8abc710: Document installation, requirements, and usage in the package README.
- Updated dependencies [8abc710]
- Updated dependencies [8abc710]
  - @nn/entities@3.0.1
  - @nn/observable@3.0.2
  - @nn/store@3.0.1

## 3.0.0

### Major Changes

- 5d1e50e: Sync engines expose their connection lifecycle and failures directly, through `onStateChange` and `onError`, instead of `session` and `delegate`.

  - `sync.session.retry()` and `sync.session.detach()` become `sync.retry()` and `sync.detach()`. `sync.session.state`, `connected`, `disconnected` and the other state flags become `sync.state`, `sync.connected` and so on.
  - `sync.session.changes.subscribe(listener)` becomes `sync.onStateChange(listener)`.
  - `sync.delegate = { syncEngineDidFail: (engine, error) => … }` becomes `sync.onError((error) => …)`. Any number of listeners can subscribe, at any time. With none, failures are dropped.
  - `SessionState` is exported as `SyncState`, and `SyncEngineDelegate` is removed.

  Custom engines that extend `SyncEngine` still drive `this.session`, which is now protected. They report failures with `this.errors.notify(error)` instead of `this.delegate?.syncEngineDidFail(this, error)`.

### Minor Changes

- 5d1e50e: Add public `connect()` so engines can be configured and observed before starting synchronization. It starts an idle engine without exposing its session. Retry and detachment behavior stays unchanged.

### Patch Changes

- Updated dependencies [5d1e50e]
- Updated dependencies [5d1e50e]
  - @nn/observable@3.0.1
  - @nn/store@3.0.0

## 2.1.0

### Minor Changes

- 00486d7: A disconnected engine can try again: `session.retry()` starts a new connection attempt from `disconnected` and does nothing in any other state. The attempt opens, pulls and pushes every field as the first connection does.

  `session.changes` notifies observers with the new state after each transition, once its effects have run, so an engine can react when it disconnects or connects. It doesn't deliver the current state on subscribe; read `session.state` for that. Observers must not throw. `SessionState` is now exported from `@nn/sync-engine`.

## 2.0.0

### Major Changes

- a36eeaf: A failed connection attempt is reported through `syncEngineDidFail`. After a failed attempt or a lost connection, the engine stays disconnected until `session.detach()` is called. A failed attempt no longer detaches the engine silently.

  `syncEngineDidFailToPush` is replaced by `syncEngineDidFail`, which reports a failed connection attempt and a rejected push. Rename the method on your delegate:

  ```ts
  // before
  sync.delegate = {
  	syncEngineDidFailToPush(syncEngine, error) {
  		console.error(error);
  	},
  };

  // after
  sync.delegate = {
  	syncEngineDidFail(syncEngine, error) {
  		console.error(error);
  	},
  };
  ```

  Every field is pushed when the engine connects, so edits made while the transport was opening reach it. A rejected push is reported and skipped; the field is pushed again on its next change.

  The protected `attach()` is removed. A subclass starts the connection with `this.session.connect()`, which returns nothing and connects in the background, so a static factory returns the engine right away. Until the connection is made, the store shows its default values, and edits made in the meantime are pushed once it connects.

  ```ts
  // before
  public static async attach(store: Store): Promise<MySync> {
  	const sync = new MySync(store);

  	await sync.attach();

  	return sync;
  }

  // after
  public static attach(store: Store): MySync {
  	const sync = new MySync(store);

  	sync.session.connect();

  	return sync;
  }
  ```

  `detach()` moves to the now public `session`. Call `sync.session.detach()` instead of `sync.detach()`.

  ```ts
  // before
  sync.detach();

  // after
  sync.session.detach();
  ```

  `session.detach()` is final. Calling `session.connect()` after `session.detach()` does nothing, so create a new engine to sync again. `close()` is called once after each `open()`, when the connection attempt fails or the connection ends, and is no longer called when `session.detach()` runs on an engine that never opened.

  `open(signal)` receives an `AbortSignal` that aborts when the connection ends, so a subclass can cancel a pending open. A subclass that implements `open()` without the signal still compiles. An `open()` that finishes after the signal aborts should release what it opened.

  A subclass whose transport closed but can be opened again calls `this.session.reconnect()`. A connected engine closes, then opens, pulls and pushes every field again. `reconnect()` does nothing unless the engine is connected, and a failed reconnect is reported like a failed attempt.

  A subclass reports that its transport dropped with `this.session.drop()`. The engine closes the connection and stops pushing. A lost connection isn't reported through `syncEngineDidFail`, so a subclass that wants the app to see the cause reports it itself.

### Minor Changes

- dbd5b8a: `pull(name)` is optional, so a subclass whose transport delivers the stored state through `receive()` while it opens, such as an event stream or a broadcast channel, no longer needs an empty `pull()`. An engine without `pull()` connects and pushes every field as soon as `open()` resolves. Subclasses that implement `pull()` keep working unchanged.

### Patch Changes

- Updated dependencies [a36eeaf]
  - @nn/store@2.1.0

## 1.0.0

### Major Changes

- b04e31b: Adds the abstract `SyncEngine` class that every sync engine extends.

  An engine implements only its transport: `open()`, `close()`, `pull(name)` and `push(name, entry)`. It starts by calling the protected `attach()`, for example from a static factory as `RepositorySync.attach()` does. `SyncEngine` then pushes every change the store reports and runs the bootstrap in the background. The bootstrap calls `open()`, then pulls each schema field and merges the stored value into the store. If `open()` or any `pull()` throws, the engine detaches itself.

  `push()` can run before `open()` finishes, because changes are pushed right away. Restored values are pushed back too, since merging them counts as a change. A failed `push()` doesn't detach the engine. It calls `syncEngineDidFailToPush(syncEngine, error)` on the engine's `delegate` instead. Without a delegate, the failure is ignored.

  `detach()` stops pushing and calls `close()` once. It can run before `open()` has finished or after it failed, so `close()` must handle both. `close()` isn't called again when `open()` finishes after `detach()`.

  A push-based engine passes incoming records to `receive(entries)`. `entries` must hold a record for every schema field.

  Install this package only to write your own sync engine; the engines depend on it already.

### Patch Changes

- b04e31b: Waits for the transport to open before sending store changes. Changes made while opening aren't queued. The protected `attach()` method now returns a promise and handles initial loading directly.
- Updated dependencies [b04e31b]
- Updated dependencies [b04e31b]
  - @nn/observable@2.0.0
  - @nn/store@2.0.0
