export class Collection<Type> extends Array<Type> {
	static createCollectionOf<T>(): Collection<T> {
		return new Collection<T>();
	}
}
