---
"@nn/sync-engine": major
---

A failed connection attempt is reported through `syncEngineDidFail`. After a failed attempt or a lost connection, the engine stays disconnected until `session.detach()` is called. A failed attempt no longer detaches the engine silently.

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
