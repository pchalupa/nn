import { Repository } from "@nn/repository";

export class InMemoryRepository<Value> extends Repository<Value> {
	private data = new Map<string, string>();

	protected store(key: string, value: string): void {
		this.data.set(key, value);
	}

	protected retrieve(key: string): string | undefined {
		return this.data.get(key);
	}
}
