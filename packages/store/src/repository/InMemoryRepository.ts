import { Repository } from "./Repository";

export class InMemoryRepository extends Repository {
	data = new Map<string, unknown>();

	get(id: string) {
		return this.data.get(id);
	}

	set(id: string, value: unknown) {
		this.data.set(id, value);
		this.emit("didSet", id, value);
	}
}
