import type { SnapshotDelegate } from "./SnapshotDelegate";

export class Snapshot<Type = unknown> {
	public delegate?: SnapshotDelegate;

	constructor(private data: Type) {}

	get length() {
		return this.data.data.length;
	}

	get id() {
		// This is not the optimal and fastest way of doing ids
		return JSON.stringify(this.data.data);
	}

	// This should not be responsibility of the snapshot
	map<T>(callback: (data: Type, index: number) => T) {
		return this.data.map(callback);
	}

	// This should not be responsibility of the snapshot
	push(value: Type) {
		this.delegate?.didPush?.(value);
	}
}
