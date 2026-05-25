import { Entity } from "./Entity";

export class LWWMap<Value extends Record<string, Entity>> extends Entity<Value> {
	private value: Value = Object.create(null);

	[index: string]: unknown;

	constructor(value: Value) {
		super();

		for (const property in value) {
			this.value[property] = value[property];

			this.value[property].subscribe(() => this.emit());

			Object.defineProperty(this, property, {
				get: () => this.value[property].current,
				set: (next) => {
					this.value[property].current = next;
				},
			});
		}
	}

	get [Symbol.toStringTag]() {
		return "LWWMap";
	}

	get current(): Value {
		const result = Object.create(null);

		for (const property in this.value) {
			result[property] = this.value[property].current;
		}

		return result;
	}

	set current(value: Value) {
		for (const property in value) {
			this.value[property].current = value[property];
		}
	}

	merge(remote: LWWMap<Value>): LWWMap<Value> {
		for (const property in this.value) {
			this.value[property].merge(remote.value[property]);
		}

		return this;
	}
}
