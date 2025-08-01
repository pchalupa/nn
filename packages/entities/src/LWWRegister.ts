import { Time } from "@nn/time";
import type { Mergeable } from "./Mergeable";

export class LWWRegister<Value> implements Mergeable {
	private timestamp = Time.now();

	constructor(private val: Value) {}

	set value(value: Value) {
		this.val = value;
		this.timestamp = Time.now();
	}

	get value(): Value {
		return this.val;
	}

	merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.val = this.val;
			remote.timestamp = this.timestamp;
		} else if (remote.timestamp.isAfter(this.timestamp)) {
			this.val = remote.val;
			this.timestamp = remote.timestamp;
		}

		return this;
	}
}
