import { Time } from "@nn/time";
import { Entity } from "./Entity";
import type { Mergeable } from "./Mergeable";

export class LWWRegister<Value> extends Entity implements Mergeable {
	private timestamp = Time.now();

	constructor(private value: Value) {
		super();
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
