import { Repository } from "@nn/repository";

export class InMemoryRepository<Value> extends Repository<Value> {
	private data = new Map<string, Value>();

	get(id: string) {
		return this.data.get(id);
	}

	set(id: string, value: Value) {
		this.data.set(id, value);
		this.emit("didSet", id, value);
	}
}
