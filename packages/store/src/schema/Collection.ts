import { Reference } from "../Reference";
import type { Repository } from "../repository/Repository";

// TOOD: Consider implementing dispose and clean up events
export class Collection<Type> {
	private parent: Collection<Type> | undefined;

	constructor(
		private data: Reference[] = [],
		private repository?: Repository,
	) {
		if (this.repository) {
			this.repository.on("didSet", (id: string) => {
				const reference = Reference.createReferenceFor(() => this.repository.get(id));

				this.data.push(reference);
			});
		}
	}

	// TODO: this might not be needed
	static createCollectionOf<T>(options?: { data?: T[]; repository?: Repository }): Collection<T> {
		return new Collection<T>(options?.data, options?.repository);
	}

	get length() {
		return this.data.length;
	}

	// I would like to get rid of this method
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
		const id = value.id;

		this.repository?.set(id, value);
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
