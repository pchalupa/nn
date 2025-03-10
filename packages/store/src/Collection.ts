import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { Reference } from "./Reference";

export class Collection<Value extends { id: string }> {
	public events = new EventEmitter<{ update: [] }>();

	constructor(
		private data: Value[] = [],
		private repository?: Repository<Value>,
	) {}

	get length(): number {
		return this.data.length;
	}

	toString(): string {
		return this.data.toString();
	}

	push(value: Value): void {
		if (this.repository) {
			const id = value.id;
			const reference = Reference.createReferenceFor(() => this.repository?.get(id));

			this.repository?.set(id, value);
			this.data.push(reference);
		} else {
			this.data.push(value);
		}

		this.events.emit("update");
	}

	map<Type>(callback: (value: Value, index: number) => Type): Type[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Value) => boolean): Slice<Value> {
		const data = this.data.filter(predicate);
		const slice = new Slice<Value>(data, this);

		return slice;
	}
}

export class Slice<Value extends { id: string }> extends Collection<Value> {
	constructor(
		data: Value[],
		private collection: Collection<Value>,
	) {
		super(data);
	}

	push(value: Value): void {
		this.collection.push(value);
		this.events.emit("update");
	}
}
