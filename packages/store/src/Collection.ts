import { EventEmitter } from "@nn/event-emitter";
import type { Repository } from "@nn/repository";
import { Reference } from "./Reference";

export class Collection<Value extends { id: string }> {
	public events = new EventEmitter<{ update: [] }>();

	constructor(
		private data: Reference<Value>[] = [],
		private repository?: Repository<Value>,
	) {}

	get length(): number {
		return this.data.length;
	}

	once(event: "update", listener: () => void): void {
		this.events.once(event, listener);
	}

	toString(): string {
		return this.data.toString();
	}

	push(value: Value): void {
		const id = value.id;
		const reference = Reference.createReferenceFor(() => this.repository?.get(id));

		this.repository?.set(id, value);
		this.data.push(reference);
	}

	map<Type>(callback: (value: Reference<Value>, index: number) => Type): Type[] {
		const data = this.data.map(callback);

		return data;
	}

	filter(predicate: (data: Reference<Value>) => boolean): Collection<Value> {
		const data = this.data.filter(predicate);
		const slice = new Slice<Value>(data, this);

		return slice;
	}
}

export class Slice<Value extends { id: string }> extends Collection<Value> {
	constructor(
		data: Reference<Value>[],
		private collection: Collection<Value>,
	) {
		super(data);
	}

	push(value: Value): void {
		this.collection.push(value);
		this.events.emit("update");
	}
}
