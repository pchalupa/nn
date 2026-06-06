export interface Repository {
	init(schema: Record<string, unknown>): Promise<void>;

	set<Value>(id: string, value: Value, typeName: string): Promise<void>;
	getAll<Value>(typeName: string): Promise<Value[]>;
}
