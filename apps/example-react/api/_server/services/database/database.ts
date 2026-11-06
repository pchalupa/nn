export interface Database {
	get(): Promise<Record<string, unknown>>;
	update(data: Record<string, unknown>): Promise<void>;
}
