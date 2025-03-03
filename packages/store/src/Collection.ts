import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { Reference } from "./Reference";

export class Collection<Value extends { id: string }> extends EventEmitter<{ update: [] }> {
	constructor(
		private data: Reference<Value>[] = [],
		private repository?: Repository<Value>,
	) {
		super();

		this.repository?.on("didSet", (id: string) => {
			const reference = Reference.createReferenceFor(() => this.repository?.get(id));

			this.data.push(reference);
		});
	}

	get length(): number {
		return this.data.length;
	}

	toString(): string {
		return this.data.toString();
	}

	push(value: Value): void {
		this.repository?.set(value.id, value);
		this.emit("update");
	}

	map<Type>(callback: (value: Reference<Value>, index: number) => Type): Type[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Reference<Value>) => boolean): Collection<Value> {
		const data = this.data.filter(predicate);
		const collection = new Collection<Value>(data);

		collection.repository = this.repository;

		return collection;
	}
}
