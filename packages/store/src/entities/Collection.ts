import { EventEmitter } from "@nn/event-emitter";

export class Collection<Value extends { id: string }> {
	public events = new EventEmitter<{ update: [Value] }>();

	constructor(private data: Value[] = []) {}

	get length(): number {
		return this.data.length;
	}

	toString(): string {
		return this.data.toString();
	}

	push(value: Value): void {
		this.data.push(value);
		this.events.emit("update", value);
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

// TODO: Remove this class and use Collection directly
export class Slice<Value extends { id: string }> extends Collection<Value> {
	constructor(
		data: Value[],
		private collection: Collection<Value>,
	) {
		super(data);
	}

	push(value: Value): void {
		this.collection.push(value);
		this.events.emit("update", value);
	}
}
