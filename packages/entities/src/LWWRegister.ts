import { Time } from "@nn/time";
import type { Mergeable } from "./Mergeable";

export class LWWRegister<Value> implements Mergeable {
	private timestamp = Time.now();

	constructor(private val: Value) {}

	set value(value: Value) {
		this.val = value;
		this.timestamp = Time.now();
	}

	get value() {
		return this.val;
	}

	merge(register: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(register.timestamp)) {
			register.val = this.val;
			register.timestamp = this.timestamp;
		} else if (register.timestamp.isAfter(this.timestamp)) {
			this.val = register.val;
			this.timestamp = register.timestamp;
		}

		return this;
	}
}
