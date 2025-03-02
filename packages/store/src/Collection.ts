import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { Reference } from "./Reference";

// TOOD: Consider implementing dispose and clean up events
export class Collection<Type> extends EventEmitter<{ update: [] }> {
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

	get length() {
		return this.data.length;
	}

	toString() {
		return this.data.toString();
	}

	push(value: Type) {
		const id = value.id;

		this.repository?.set(id, value);
		this.emit("update");
	}

	map<T>(callback: (value: Type, index: number) => T): T[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Type) => boolean): Collection<Type> {
		const data = this.data.filter(predicate);
		const collection = new Collection(data);

		collection.repository = this.repository;

		return collection;
	}
}
