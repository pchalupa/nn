export interface RepositoryFactory {
	createRepository(keys: string[]): Promise<Repository>;
}

export interface Repository {
	set<Value>(id: string, value: Value, typeName: string): Promise<void>;
	getAll<Value>(typeName: string): Promise<Value[]>;
}
