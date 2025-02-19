export class Snapshot<Type> {
	constructor(
		private data: Type,
		private onPush: (value: object) => void,
	) {}

	get length() {
		return 0;
	}

	map<T>(fn: (data: object) => T) {
		// console.log("Mapping", this.data);
		return this.data.map(fn);
	}

	push(value: object) {
		this.data.push(value);
		this.onPush(value);
	}

	key() {
		return JSON.stringify(this.data);
	}
}
