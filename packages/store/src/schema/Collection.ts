export class Collection<Type> {
	parent: Collection<Type> = this;

	constructor(private data: Type[] = []) {}

	static createCollectionOf<T>(): Collection<T> {
		return new Collection<T>();
	}

	get length() {
		return this.data.length;
	}

	push(value: Type) {
		this.data.push(value);
	}

	map(callbackfn: (value: Type, index: number, array: Type[]) => unknown, thisArg?: unknown): Collection<Type> {
		const data = this.data.map(callbackfn, thisArg);

		return data;
	}

	filter(predicate: unknown, thisArg?: unknown): Collection<Type> {
		const data = this.data.filter(predicate, thisArg);
		// Consider adding childrens map and store exising childrens
		const collection = new Collection(data);

		collection.parent = this;

		return collection;
	}
}
