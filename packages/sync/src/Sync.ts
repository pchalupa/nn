export interface Sync {
	readonly restored: Promise<void>;

	detach(): void;
}
