import { Entity } from "./Entity";

export class LWWMap<Value extends Record<string, Entity>> extends Entity<Value> {
	private value: Value = Object.create(null);

	constructor(value: Value) {
		super();

		for (const property in value) {
			this.value[property] = value[property];

			this.value[property].subscribe(() => this.emit());
		}
	}

	get [Symbol.toStringTag]() {
		return "LWWMap";
	}

	set current(value: Value) {
		for (const property in value) {
			this.value[property] = value[property];
		}
	}

	get current(): Value {
		return this.value;
	}

	merge(remote: LWWMap<Value>): LWWMap<Value> {
		for (const property in this.value) {
			const remoteEntity = remote.value[property];

			if (remoteEntity) this.value[property].merge(remoteEntity);
		}

		return this;
	}
}
