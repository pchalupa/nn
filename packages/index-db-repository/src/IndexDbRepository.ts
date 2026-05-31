import type { Repository } from "@nn/repository";

enum Mode {
	ReadOnly = "readonly",
	ReadWrite = "readwrite",
}

export class IndexDbRepository implements Repository {
	private indexDbDatabase?: IDBDatabase;
	private version = 1;

	constructor(private readonly name = "nn-default") {}

	private processRequest<Value>(request: IDBRequest<Value>): Promise<Value> {
		return new Promise<Value>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async set<Value>(id: string, value: Value, typeName: string): Promise<void> {
		if (this.indexDbDatabase) {
			const transaction = this.indexDbDatabase.transaction(typeName, Mode.ReadWrite);

			await this.processRequest(transaction.objectStore(typeName).put(value, id));
		}
	}

	async getAll<Value>(typeName: string, _version?: number): Promise<Value[]> {
		if (this.indexDbDatabase) {
			const transaction = this.indexDbDatabase.transaction(typeName, Mode.ReadOnly);

			return this.processRequest(transaction.objectStore(typeName).getAll());
		}

		return [];
	}

	async init(schema: Record<string, unknown>): Promise<void> {
		const typeNames = Object.keys(schema);

		const existingDatabases = await indexedDB.databases();
		const existingDatabase = existingDatabases.find((db) => db.name === this.name);
		const version = Math.max(existingDatabase?.version ?? 0, this.version);
		const openRequest = indexedDB.open(this.name, version);

		const needsUpgrade = typeNames.some((typeName) => !this.indexDbDatabase?.objectStoreNames.contains(typeName));

		const indexDbDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
			openRequest.onsuccess = () => resolve(openRequest.result);
			openRequest.onupgradeneeded = () => {
				const transaction = openRequest.transaction;

				typeNames.forEach((typeName) => {
					if (!transaction?.db.objectStoreNames.contains(typeName)) {
						transaction?.db.createObjectStore(typeName);
					}
				});

				if (transaction) {
					transaction.oncomplete = () => resolve(openRequest.result);
					transaction.onerror = () => reject(openRequest.error);
				}
			};

			openRequest.onerror = () => reject(openRequest.error);
		});

		indexDbDatabase.onversionchange = () => indexDbDatabase.close();

		this.indexDbDatabase = indexDbDatabase;

		if (needsUpgrade) {
			this.indexDbDatabase.close();
			this.version++;

			return await this.init(schema);
		}
	}
}
