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

### Observing the connection

```ts
import { SyncState } from "@nn/sync-engine";

sync.onStateChange((state) => {
	if (state === SyncState.Disconnected) sync.retry();
});

sync.onError((error) => console.error(error));
```

`dispose()` stops the engine for good.
