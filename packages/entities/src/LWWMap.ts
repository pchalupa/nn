import { LWWRegister } from "./LWWRegister";
import type { Mergeable } from "./Mergeable";

export class LWWMap<Data extends Record<string, unknown>> implements Mergeable {
	private data: { [Property in keyof Data]: LWWRegister<Data[Property]> } = Object.create(null);

	[index: string]: unknown;

	constructor(data: Data) {
		for (const property in data) {
			this.data[property] = new LWWRegister(data[property]);

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
