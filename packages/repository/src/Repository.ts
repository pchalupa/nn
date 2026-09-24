export interface Repository {
	init(schema: Record<string, unknown>): Promise<void>;

	set<Value>(id: string, value: Value, typeName: string): Promise<void>;
	get<Value>(id: string, typeName: string): Promise<Value | undefined>;
	getAll<Value>(typeName: string): Promise<Value[]>;
}
