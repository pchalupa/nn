import { SyncEngine } from "@goodstate/sync-engine";
import type { Replica } from "@goodstate/sync-engine/replica";

import { LocalStorage } from "./local-storage";

/**
 * Persists a replica in `localStorage` and merges what other tabs write there.
 *
 * @example
 * new LocalStorageSync(store, "my-app").connect();
 */
export class LocalStorageSync extends SyncEngine {
	private readonly storage: LocalStorage;

	constructor(replica: Replica, name = "goodstate-default") {
		super(replica);

		this.storage = new LocalStorage(name);
		this.storage.delegate = {
			localStorageDidChange: (property, entry) => {
				try {
					this.receive({ [property]: entry });
				} catch (error) {
					this.errors.notify(error);
				}
			},
			localStorageDidFail: (error) => this.errors.notify(error),
		};
	}

	protected async open(signal: AbortSignal): Promise<void> {
		this.storage.listen(signal);
	}

	protected close(): void {}

	protected async pull(name: string): Promise<unknown> {
		return this.storage.get(name);
	}

	protected async push(name: string, entry: unknown): Promise<void> {
		this.storage.set(name, entry);
	}
}
