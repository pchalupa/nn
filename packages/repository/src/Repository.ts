export interface Repository {
	set<Value>(id: string, value: Value): Promise<void>;
	getAll<Value>(typeName: string): Promise<Value[]>;

	createRepository: () => Promise<void>;
}
