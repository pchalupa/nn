import type { Repository } from "@nn/repository";

enum Mode {
	ReadOnly = "readonly",
	ReadWrite = "readwrite",
}

export class IndexDbRepository implements Repository {
	private static readonly defaultName = "nn-default";

	constructor(private repository: IDBDatabase) {}

	private processRequest<Value>(request: IDBRequest<Value>): Promise<Value> {
		return new Promise<Value>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async set<Value>(id: string, value: Value, typeName: string): Promise<void> {
		const transaction = this.repository.transaction(typeName, Mode.ReadWrite);

		await this.processRequest(transaction.objectStore(typeName).put(value, id));
	}

	async getAll<Value>(typeName: string): Promise<Value[]> {
		const transaction = this.repository.transaction(typeName, Mode.ReadOnly);

		return this.processRequest(transaction.objectStore(typeName).getAll());
	}

	static async createRepository(typeNames: string[]): Promise<IndexDbRepository> {
		const existingDatabases = await indexedDB.databases();
		const existingDatabase = existingDatabases.find((db) => db.name === IndexDbRepository.defaultName);
		const version = existingDatabase?.version ?? 1;
		const openRequest = indexedDB.open(IndexDbRepository.defaultName, version);

		const repository = await new Promise<IDBDatabase>((resolve, reject) => {
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onupgradeneeded = (event) => {
				console.log("onupgradeneeded");
				const transaction: IDBTransaction = event.currentTarget.transaction;

				typeNames.forEach((typeName) => {
					transaction.db.createObjectStore(typeName);
				});

				transaction.oncomplete = () => resolve(openRequest.result);
			};

			openRequest.onerror = () => reject(openRequest.error);
		});

		return new IndexDbRepository(repository);
	}
}
