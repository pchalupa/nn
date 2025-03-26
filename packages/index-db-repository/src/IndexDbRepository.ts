import type { Repository } from "@nn/repository";

enum Mode {
	ReadOnly = "readonly",
	ReadWrite = "readwrite",
}

export class IndexDbRepository implements Repository {
	private static readonly defaultName = "nn-default";

	constructor(private repository: IDBDatabase) {}

	private close(): void {
		this.repository.close();
	}

	private includes(typeName: string): boolean {
		return this.repository.objectStoreNames.contains(typeName);
	}

	private processRequest<Value>(request: IDBRequest<Value>): Promise<Value> {
		return new Promise<Value>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	private async upgrade(objectStores: string): Promise<void> {
		this.close();

		const existingDatabase = (await indexedDB.databases()).find((db) => db.name === IndexDbRepository.defaultName);
		const version = existingDatabase?.version ?? 1;
		const openRequest = indexedDB.open(IndexDbRepository.defaultName, version + 1);

		const repository = await new Promise<IDBDatabase>((resolve, reject) => {
			openRequest.onupgradeneeded = () => {
				const repository = openRequest.result;

				repository.createObjectStore(objectStores);

				resolve(repository);
			};
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onerror = () => reject(openRequest.error);
		});

		this.repository = repository;
	}

	async set<Value>(id: string, value: Value, typeName: string): Promise<void> {
		const transaction = this.repository.transaction(typeName, Mode.ReadWrite);

		await this.processRequest(transaction.objectStore(typeName).put(value, id));
	}

	async getAll<Value>(typeName: string): Promise<Value[]> {
		if (!this.includes(typeName)) await this.upgrade(typeName);

		const transaction = this.repository.transaction(typeName, Mode.ReadOnly);

		return this.processRequest(transaction.objectStore(typeName).getAll());
	}

	static async createRepository(): Promise<IndexDbRepository> {
		const version = (await indexedDB.databases()).find((db) => db.name === IndexDbRepository.defaultName)?.version;
		const openRequest = indexedDB.open(IndexDbRepository.defaultName, version);

		const repository = await new Promise<IDBDatabase>((resolve, reject) => {
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onerror = () => reject(openRequest.error);
		});

		return new IndexDbRepository(repository);
	}
}
