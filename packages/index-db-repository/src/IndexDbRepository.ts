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

	async getAll<Value>(typeName: string, version?: number): Promise<Value[]> {
		const transaction = this.repository.transaction(typeName, Mode.ReadOnly);

		return this.processRequest(transaction.objectStore(typeName).getAll());
	}

	static async createRepository(typeNames: string[], upgradeVersion?: number): Promise<IndexDbRepository> {
		const existingDatabases = await indexedDB.databases();
		const existingDatabase = existingDatabases.find((db) => db.name === IndexDbRepository.defaultName);
		const version = upgradeVersion ?? existingDatabase?.version ?? 1;
		const openRequest = indexedDB.open(IndexDbRepository.defaultName, version);

		const repository = await new Promise<IDBDatabase>((resolve, reject) => {
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onupgradeneeded = () => {
				const transaction = openRequest.transaction;

				typeNames.forEach((typeName) => transaction?.db.createObjectStore(typeName));

				if (transaction) {
					transaction.oncomplete = () => resolve(openRequest.result);
					transaction.onerror = () => reject(openRequest.error);
				}
			};

			openRequest.onerror = () => reject(openRequest.error);
		});

		repository.onversionchange = () => repository.close();

		try {
			typeNames.forEach((typeName) => {
				if (!repository.objectStoreNames.contains(typeName)) throw new Error();
			});
		} catch (error) {
			return await IndexDbRepository.createRepository(typeNames, version + 1);
		}

		return new IndexDbRepository(repository);
	}
}
