# @nn/sync-engine

Base class for sync engines.

## Installation

```sh
npm install @nn/sync-engine @nn/store
```

## Usage

A sync engine keeps a store in sync with something outside it, such as storage, another tab, or a server. Extend `SyncEngine` and implement how to open and close the connection and how to push a changed entry. Call `receive` with incoming entries to merge them into the store.

```ts
import type { Encoded } from "@nn/entities/codable";
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

	protected async push(name: string, entry: Encoded): Promise<void> {
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

`pull` is optional. The engine calls it for each state property when it connects, so saved state loads into the store. Here the `storage` event delivers changes that other tabs write to `localStorage`.

### Lifecycle

`connect()` runs these steps in order:

1. `open(signal)` sets up the connection. `signal` aborts when the connection closes, so pass it on to anything that waits.
2. `pull(name)` runs for each top-level state property, and each value it returns is merged into the store.
3. The engine is connected. It pushes every entry of the store once, then pushes each entry that changes.

`close()` runs when the connection ends or the engine is disposed. `receive(entries)` merges entries keyed by state property name and ignores names that are not in the schema. Entries are what `Store.encode()` produces, so a value that went through `JSON.stringify` merges back as is.

If `open` or `pull` throws, the engine reports the error to `onError` and moves to `SyncState.Disconnected`. If `push` throws, the engine reports the error and stays connected.

The built-in engines are complete examples: [`@nn/broadcast-sync`](https://github.com/pchalupa/nn/tree/main/packages/broadcast-sync) for push-only messaging, [`@nn/indexdb-sync`](https://github.com/pchalupa/nn/tree/main/packages/indexdb-sync) for storage with `pull`, and [`@nn/sse-sync`](https://github.com/pchalupa/nn/tree/main/packages/sse-sync) for a server connection.

### Observing the connection

```ts
import { SyncState } from "@nn/sync-engine";

sync.onStateChange((state) => {
	if (state === SyncState.Disconnected) sync.retry();
});

sync.onError((error) => console.error(error));
```

`dispose()` stops the engine for good.
