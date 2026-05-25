import { Time } from "@nn/time";
import { Entity } from "./Entity";

export class LWWRegister<Value> extends Entity<Value> {
	private value: Value;
	private timestamp = Time.now();

	constructor(value: Value) {
		super();

		this.value = value;
	}

	get [Symbol.toStringTag]() {
		return "LWWRegister";
	}

	set current(value: Value) {
		this.value = value;
		this.timestamp = Time.now();
		this.emit();
	}

	get current(): Value {
		return this.value;
	}

	merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.value = this.value;
			remote.timestamp = this.timestamp;
		} else if (remote.timestamp.isAfter(this.timestamp)) {
			this.value = remote.value;
			this.timestamp = remote.timestamp;

			this.emit();
		}

		return this;
	}
}
