import { Time } from "@nn/time";
import type { Mergeable } from "./Mergeable";

export class LWWRegister<Value> implements Mergeable {
	private timestamp = Time.now();

	constructor(private value: Value) {}

	get [Symbol.toStringTag]() {
		return "LWWRegister";
	}

	set current(value: Value) {
		this.value = value;
		this.timestamp = Time.now();
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
		}

		return this;
	}
}
