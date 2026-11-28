# @goodstate/sync-engine

Base class for sync engines.

## Installation

```sh
npm install @goodstate/sync-engine
```

## Usage

A sync engine keeps a replica in sync with something outside it, such as storage, another tab, or a server. Extend `SyncEngine` and implement four hooks: `open` and `close` for the connection, `push` for a changed entry, and the optional `pull` to load saved state. Call `receive` with incoming entries to merge them into the replica.

Start from the built-in engine closest to your transport. Each one is a single short file:

| Engine                                                                                                                      | Transport                                                                                             | What it shows                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`BroadcastSync`](https://github.com/pchalupa/goodstate/blob/main/packages/broadcast-sync/src/broadcast-sync.ts)            | [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)               | Push only, with no `pull`. Checks each incoming message before passing it to `receive`.                                                                                                       |
| [`IndexDbSync`](https://github.com/pchalupa/goodstate/blob/main/packages/indexdb-sync/src/index-db-sync.ts)                 | [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)                           | `pull` restores saved state. The storage code lives in its own class with a delegate. Calls `session.reopen()` when another tab upgrades the database and `session.drop()` when it's deleted. |
| [`LocalStorageSync`](https://github.com/pchalupa/goodstate/blob/main/packages/local-storage-sync/src/local-storage-sync.ts) | [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)                | `pull` restores saved state, and `storage` events merge what other tabs write. The listener is removed through the `signal` that `open` receives, so `close` has nothing to do.               |
| [`SseSync`](https://github.com/pchalupa/goodstate/blob/main/packages/sse-sync/src/sse-sync.ts)                              | [Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) and `fetch` | `open` waits for the server's first event and passes on the `signal`. Calls `session.drop()` when the stream closes.                                                                          |

Each package's tests show how to test an engine in Node, with a fake or in-process transport.

### Replica

The engine syncs any object that matches the `Replica` interface from `@goodstate/sync-engine/replica`. A `Store` from [`@goodstate/store`](https://github.com/pchalupa/goodstate/tree/main/packages/store) matches it, so you can pass one directly. The engine doesn't import `@goodstate/store` or `@goodstate/entities`.

```ts
import type { Unsubscribe } from "@goodstate/observable/observable";

interface Replica {
	readonly schema: { readonly properties: Readonly<Record<string, unknown>> };
	encode(): { readonly data: Readonly<Record<string, unknown>> };
	merge(name: string, value: unknown): void;
	onChange(listener: (changes: Readonly<Record<string, unknown>>) => void): Unsubscribe;
}
```

- `schema.properties` names the top-level entries the engine pulls and accepts. Only the keys are read.
- `encode().data` holds every entry, keyed by name, for the first push after connecting.
- `merge(name, value)` applies an entry that was pulled or received.
- `onChange(listener)` reports changed entries, keyed by name, so the engine can push them.

### Lifecycle

`connect()` runs these steps in order:

1. `open(signal)` sets up the connection. `signal` aborts when the connection closes, so pass it on to anything that waits.
2. `pull(name)` runs for each property in the replica's schema, and each value it returns is merged into it.
3. The engine is connected. It pushes every entry of `encode().data` once, then pushes each entry that changes.

`close()` runs when the connection ends or the engine is disposed. `receive(entries)` merges entries keyed by name and ignores names that are not in the replica's schema. Entries are opaque to the engine. It passes on whatever the replica produces, so a value that went through `JSON.stringify` merges back as is.

If `open` or `pull` throws, the engine reports the error to `onError` and moves to the `"disconnected"` state. If `push` throws, the engine reports the error and stays connected.

A subclass whose transport goes away calls `this.session.drop()`, which moves the engine to `"disconnected"`. A subclass whose transport can open again calls `this.session.reopen()`, which closes the connection and runs `connect()`'s steps again.

### Observing the connection

```ts
sync.onStateChange((state) => {
	if (state === "disconnected") sync.retry();
});

sync.onError((error) => console.error(error));
```

`dispose()` stops the engine for good.
