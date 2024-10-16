export class List<Item extends { id: string }> {
	private data: Map<string, Item>;

	private constructor(data: Map<string, Item>) {
		this.data = data;
	}

	public page(skip: number, limit: number) {
		return this.data.entries().drop(skip).take(limit).toArray();
	}

	public filter(predicate: (item: Item) => boolean) {
		return this.data.values().filter(predicate).toArray();
	}

	public push(item: Item) {
		return this.data.set(item.id, item);
	}

	public drop(id: string) {
		return this.data.delete(id);
	}

	public static fromArray<T extends { id: string }>(data: T[]): List<T> {
		return new List(new Map(data?.map((item) => [item.id, item])));
	}
}
