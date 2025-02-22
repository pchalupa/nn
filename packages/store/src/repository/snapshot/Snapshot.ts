export class Snapshot<Type = unknown> {
	constructor(
		private data: Type,
		private onPush: () => void,
	) {}

	get length() {
		return this.data.length;
	}

	get id() {
		return JSON.stringify(this.data);
	}

	map<T>(fn: (data: Type) => T) {
		return this.data.map(fn);
	}

	push(value: object) {
		this.data.push(value);
		this.onPush(value);
	}
}
