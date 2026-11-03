import type { Encoded } from "@nn/entities/Codable";

enum Mode {
	ReadOnly = "readonly",
	ReadWrite = "readwrite",
}

export class IndexDb {
	private version = 1;
	private indexDbDatabase?: IDBDatabase;
	private transactions = new Map<string, IDBTransaction>();

	constructor(private readonly name = "nn-default") {}

	public async set(name: string, entry: Encoded): Promise<void> {
		IndexDb.assertIndexDB(this.indexDbDatabase);

		this.transactions.get(name)?.abort();

		const transaction = this.indexDbDatabase.transaction(name, Mode.ReadWrite);
		const request = transaction.objectStore(name).put(entry, name);

		this.transactions.set(name, transaction);

		queueMicrotask(() => {
			if (this.transactions.get(name) !== transaction) return;

			this.transactions.delete(name);
			transaction.commit();
		});

		await this.processRequest(request);
	}

	public async get(name: string): Promise<Encoded | undefined> {
		IndexDb.assertIndexDB(this.indexDbDatabase);

		const transaction = this.indexDbDatabase.transaction(name, Mode.ReadOnly);

		return await this.processRequest<Encoded | undefined>(transaction.objectStore(name).get(name));
	}

	public async delete(key: string, typeName: string): Promise<void> {
		IndexDb.assertIndexDB(this.indexDbDatabase);

		const transaction = this.indexDbDatabase.transaction(typeName, Mode.ReadWrite);

		await this.processRequest(transaction.objectStore(typeName).delete(key));
	}

	public async getAll(typeName: string): Promise<Encoded[]> {
		IndexDb.assertIndexDB(this.indexDbDatabase);

		const transaction = this.indexDbDatabase.transaction(typeName, Mode.ReadOnly);

		return this.processRequest(transaction.objectStore(typeName).getAll());
	}

	public close(): void {
		this.indexDbDatabase?.close();
		this.indexDbDatabase = undefined;
	}

	private processRequest<Result>(request: IDBRequest<Result>): Promise<Result> {
		return new Promise<Result>((resolve, reject) => {
			const { transaction } = request;

			request.onerror = () => reject(request.error);

			if (transaction) {
				transaction.onabort = () => reject(transaction.error);
				transaction.oncomplete = () => resolve(request.result);
			}
		});
	}

	private static assertIndexDB(database: unknown): asserts database is IDBDatabase {
		if (!(database instanceof IDBDatabase)) throw new Error("Index DB is not initialized.");
	}

	public async init(schema: Record<string, unknown>): Promise<void> {
		const typeNames = Object.keys(schema);

		const existingDatabases = await indexedDB.databases();
		const existingDatabase = existingDatabases.find((db) => db.name === this.name);
		const version = Math.max(existingDatabase?.version ?? 0, this.version);
		const openRequest = indexedDB.open(this.name, version);
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
		const needsUpgrade = typeNames.some((typeName) => !indexDbDatabase.objectStoreNames.contains(typeName));

		if (needsUpgrade) {
			indexDbDatabase.close();
			this.version = indexDbDatabase.version + 1;

			return await this.init(schema);
		}

		indexDbDatabase.onversionchange = () => indexDbDatabase.close();

		this.indexDbDatabase = indexDbDatabase;
	}
}
