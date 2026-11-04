import type { Encoded } from "@nn/entities/codable";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

import { IndexDb } from "./index-db";

export class IndexDbSync extends SyncEngine {
	private readonly repository: IndexDb;

	constructor(store: Store, name: string) {
		super(store);

		this.repository = new IndexDb(name);
		this.repository.delegate = {
			indexDbDidChangeVersion: () => this.connection.lost(),
		};
	}

	protected async open(signal: AbortSignal): Promise<void> {
		await this.repository.init(this.store.schema.properties);

		if (signal.aborted) this.repository.close();
	}

	protected close(): void {
		this.repository.close();
	}

	protected pull(name: string): Promise<unknown> {
		return this.repository.get(name);
	}

	protected push(name: string, entry: Encoded): Promise<void> {
		return this.repository.set(name, entry);
	}

	public static attach(store: Store, name = "nn-default"): IndexDbSync {
		const indexDbSync = new IndexDbSync(store, name);

		indexDbSync.attach();

		return indexDbSync;
	}
}
