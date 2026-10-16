export interface Repository {
	init(schema: Record<string, unknown>): Promise<void>;

	get(name: string): Promise<Entry | undefined>;
	set(name: string, entry: Entry): Promise<void>;
}

export interface Entry<Data = unknown, Metadata extends Record<string, unknown> = Record<string, unknown>> {
	key: string;
	data: Data;
	metadata: Metadata;
}
