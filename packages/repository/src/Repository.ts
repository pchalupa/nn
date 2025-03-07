export abstract class Repository<Value> {
	abstract get(id: string): Value | undefined;

	abstract set(id: string, value: Value): void;
}
