export abstract class Repository {
	abstract get(id: unknown): unknown | undefined;

	abstract set(id: unknown, value: unknown): void;
}
