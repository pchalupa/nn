export class Snapshot<Type = unknown> {
	constructor(
		private data: Type,
		private onPush: () => void,
	) {}

	get length() {
		return 0;
	}

	get id() {
		return JSON.stringify(this.data);
	}

	map<T>(fn: (data: Type) => T) {
		// console.log("Mapping", this.data);
		return this.data.map(fn);
	}

	push(value: object) {
		this.data.push(value);
		this.onPush();
	}
}
