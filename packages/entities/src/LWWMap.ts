import { Entity } from "./Entity";
import { LWWRegister } from "./LWWRegister";
import type { Mergeable } from "./Mergeable";

export class LWWMap<Data extends Record<string, unknown>> extends Entity implements Mergeable {
	private data: { [Property in keyof Data]: LWWRegister<Data[Property]> } = Object.create(null);

	[index: string]: unknown;

	constructor(data: Data) {
		super();

		for (const property in data) {
			this.data[property] = new LWWRegister(data[property]);
			this.data[property].subscribe(() => this.emit());

			Object.defineProperty(this, property, {
				get: () => this.data[property]?.current,
				set: (value) => {
					this.data[property].current = value;
				},
			});
		}
	}

	get [Symbol.toStringTag]() {
		return "LWWMap";
	}

	merge(remote: LWWMap<Data>): LWWMap<Data> {
		for (const property in this.data) {
			this.data[property].merge(remote.data[property]);
		}

		return this;
	}
}
