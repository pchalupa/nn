import { SyncEngine } from "@nn/sync-engine";
import type { Replica } from "@nn/sync-engine/replica";

import { IndexDb } from "./index-db";

/**
 * Persists a replica in IndexedDB and loads it back on connect.
 *
 * @example
 * new IndexDbSync(store, "my-app").connect();
 */
export class IndexDbSync extends SyncEngine {
	private readonly indexDb: IndexDb;

	constructor(replica: Replica, name = "nn-default") {
		super(replica);

		this.indexDb = new IndexDb(name);
		this.indexDb.delegate = {
			indexDbDidChangeVersion: () => this.session.reopen(),
			indexDbDidDelete: () => this.session.drop(),
		};
	}

	protected async open(signal: AbortSignal): Promise<void> {
		await this.indexDb.init(this.replica.schema.properties);

		if (signal.aborted) this.indexDb.close();
	}

	protected close(): void {
		this.indexDb.close();
	}

	protected pull(name: string): Promise<unknown> {
		return this.indexDb.get(name);
	}

	protected push(name: string, entry: unknown): Promise<void> {
		return this.indexDb.set(name, entry);
	}
}
