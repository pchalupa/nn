import type { Encoded } from "@nn/entities/codable";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

import { IndexDb } from "./index-db";

export class IndexDbSync extends SyncEngine {
	private readonly repository: IndexDb;

	constructor(store: Store, name: string) {
		super(store);

		this.repository = new IndexDb(name);
	}

	protected async open(): Promise<void> {
		await this.repository.init(this.store.schema.properties);
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

	public static async attach(store: Store, name = "nn-default"): Promise<IndexDbSync> {
		const indexDbSync = new IndexDbSync(store, name);

		await indexDbSync.attach();

		return indexDbSync;
	}
}
