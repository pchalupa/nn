export interface Repository {
	init(schema: Record<string, unknown>): Promise<void>;

	set<Value>(key: string, value: Value, typeName: string): Promise<void>;
	get<Value>(key: string, typeName: string): Promise<Value | undefined>;
	delete(key: string, typeName: string): Promise<void>;
	getAll<Value>(typeName: string): Promise<Value[]>;
}
