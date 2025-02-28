import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { Reference } from "./Reference";

// TOOD: Consider implementing dispose and clean up events
export class Collection<Type> extends EventEmitter<{ update: [] }> {
	private parent: Collection<Type> | undefined;

	constructor(
		private data: Reference[] = [],
		private repository?: Repository,
	) {
		super();

		if (this.repository) {
			this.repository.on("didSet", (id: string) => {
				const reference = Reference.createReferenceFor(() => this.repository.get(id));

				this.data.push(reference);
			});
		}
	}

	set length(value: number) {
		this.data.length = value;
	}

	get length() {
		return this.data.length;
	}

	toString() {
		return this.data.toString();
	}

	[Symbol.toStringTag] = "Collection";

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

		// This is not efficient
		const col = this.findRoot();

		col.repository?.set(id, value);
		this.emit("update");
	}

	map<T>(callback: (value: Type, index: number) => T): T[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Type) => boolean): Collection<Type> {
		const data = this.data.filter(predicate);
		// Consider adding children map and store existing children
		const collection = new Collection(data);
		const slice = new Slice(data, this);

		collection.parent = this;

		return collection;
	}

	// TODO: this might not be needed
	static createCollectionOf<T>(options?: { data?: T[]; repository?: Repository }): Collection<T> {
		return new Collection<T>(options?.data, options?.repository);
	}
}

class Slice<Type> {
	constructor(
		private data: Reference[],
		private collection: Collection<Type>,
	) {}

	map<T>(callback: (value: Type, index: number) => T): T[] {
		const data = this.data.map(callback);

		return data;
	}

	push(value: Type) {
		const id = value.id;

		// This is not efficient
		const col = this.findRoot();

		col.repository?.set(id, value);
		this.emit("update");
	}
}
