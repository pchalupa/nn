import type { Encoded } from "@nn/entities/Codable";
import type { Repository } from "@nn/repository";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

export class RepositorySync extends SyncEngine {
	constructor(
		store: Store,
		private repository: Repository,
	) {
		super(store);
	}

	protected async open(): Promise<void> {
		await this.repository.init(this.store.schema.properties);
	}

	protected close() {
		this.repository.close();
	}

	protected pull(name: string): Promise<unknown> {
		return this.repository.get(name);
	}

	protected push(name: string, entry: Encoded): Promise<void> {
		return this.repository.set(name, entry);
	}

	public static attach(store: Store, repository: Repository): RepositorySync {
		const repositorySync = new RepositorySync(store, repository);

		repositorySync.attach();

		return repositorySync;
	}
}
