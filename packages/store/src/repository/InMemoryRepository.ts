import { Repository } from "./Repository";

export class InMemoryRepository extends Repository {
	private data = new Map();

	get(id: unknown) {
		return this.data.get(id);
	}

	set(id: unknown, value: unknown) {
		this.data.set(id, value);
	}
}
