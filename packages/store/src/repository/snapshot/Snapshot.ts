import type { SnapshotDelegate } from "./SnapshotDelegate";

export class Snapshot<Type = unknown> {
	public delegate?: SnapshotDelegate;

	constructor(private data: Type) {}

	get length() {
		return this.data.length;
	}

	get id() {
		return JSON.stringify(this.data);
	}

	map<T>(callback: (data: Type, index: number) => T) {
		return this.data.map(callback);
	}

	push(value: Type) {
		this.data.push(value);
		this.delegate?.didPush?.(value);
	}
}
