export class Collection<Type> {
	private parent: Collection<Type> | undefined;

	constructor(private data: Type[] = []) {}

	static createCollectionOf<T>(): Collection<T> {
		return new Collection<T>();
	}

	get length() {
		return this.data.length;
	}

	findRoot() {
		let parent = this;

		while (parent) {
			if (parent.parent === undefined) {
				break;
			}

			parent = parent.parent;
		}

		return parent;
	}

	push(value: Type) {
		this.data.push(value);
	}

	map<T>(callback: (value: Type, index: number) => T): T[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Type) => boolean): Collection<Type> {
		const data = this.data.filter(predicate);
		// Consider adding children map and store existing children
		const collection = new Collection(data);

		collection.parent = this;

		return collection;
	}
}
