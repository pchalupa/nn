import { Entity } from "./Entity";

export class LWWMap<Fields extends Record<string, Entity>> extends Entity<Fields> {
	constructor(private fields: Fields) {
		super();

		for (const key in fields) {
			const field = fields[key];

			field.eventEmitter.once("update", () => this.emit());
		}
	}

	get [Symbol.toStringTag]() {
		return "LWWMap";
	}

	get current(): Fields {
		return this.fields;
	}

	set current(fields: Fields) {
		for (const key in fields) {
			const field = fields[key];

			field.eventEmitter.once("update", () => this.emit());
			this.fields[key] = field;
		}

		this.emit();
	}

	merge(remote: LWWMap<Fields>): this {
		for (const key in this.fields) {
			const localField = this.fields[key];
			const remoteField = remote.fields[key];

			if (remoteField) localField.merge(remoteField);
		}

		return this;
	}
}
