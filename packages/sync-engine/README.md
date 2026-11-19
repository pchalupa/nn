# @nn/sync-engine

Base class for sync engines.

## Installation

```sh
npm install @nn/sync-engine
```

## Usage

A sync engine keeps a replica in sync with something outside it, such as storage, another tab, or a server. Extend `SyncEngine` and implement how to open and close the connection and how to push a changed entry. Call `receive` with incoming entries to merge them into the replica.

```ts
import { SyncEngine } from "@nn/sync-engine";

class LocalStorageSync extends SyncEngine {
	protected async open(): Promise<void> {
		window.addEventListener("storage", this.onStorage);
	}

	protected close(): void {
		window.removeEventListener("storage", this.onStorage);
	}

	protected async pull(name: string): Promise<unknown> {
		const value = localStorage.getItem(name);

		return value === null ? undefined : JSON.parse(value);
	}

	protected async push(name: string, entry: unknown): Promise<void> {
		localStorage.setItem(name, JSON.stringify(entry));
	}

	private readonly onStorage = (event: StorageEvent) => {
		if (event.key && event.newValue) {
			const entry: unknown = JSON.parse(event.newValue);

			this.receive({ [event.key]: entry });
		}
	};
}

const sync = new LocalStorageSync(store);

sync.connect();
```

`pull` is optional. The engine calls it for each property in the replica's schema when it connects, so saved state loads into the replica. Here the `storage` event delivers changes that other tabs write to `localStorage`.

### Replica

The engine syncs any object that matches the `Replica` interface from `@nn/sync-engine/replica`. A `Store` from [`@nn/store`](https://github.com/pchalupa/nn/tree/main/packages/store) matches it, so you can pass one directly. The engine doesn't import `@nn/store` or `@nn/entities`.

```ts
import type { Unsubscribe } from "@nn/observable/observable";

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

The built-in engines are complete examples: [`@nn/broadcast-sync`](https://github.com/pchalupa/nn/tree/main/packages/broadcast-sync) for push-only messaging, [`@nn/indexdb-sync`](https://github.com/pchalupa/nn/tree/main/packages/indexdb-sync) for storage with `pull`, and [`@nn/sse-sync`](https://github.com/pchalupa/nn/tree/main/packages/sse-sync) for a server connection.

### Observing the connection

```ts
sync.onStateChange((state) => {
	if (state === "disconnected") sync.retry();
});

sync.onError((error) => console.error(error));
```

`dispose()` stops the engine for good.
