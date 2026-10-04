import { Time } from "@nn/time";

import { Entity } from "./Entity";

export class LWWRegister<Value> extends Entity<Value> {
	private value: Value;
	private timestamp = Time.now();

	constructor(value: Value, key?: string) {
		super(key);

		this.value = value;
	}

	public get [Symbol.toStringTag](): string {
		return "LWWRegister";
	}

	public set current(value: Value) {
		this.value = value;
		this.timestamp = Time.now();
		this.emit("change");
	}

	public get current(): Value {
		return this.value;
	}

	public merge(remote: LWWRegister<Value>): LWWRegister<Value> {
		if (this.timestamp.isAfter(remote.timestamp)) {
			remote.value = this.value;
			remote.timestamp = this.timestamp;
		} else if (remote.timestamp.isAfter(this.timestamp)) {
			this.value = remote.value;
			this.timestamp = remote.timestamp;

			this.emit("change");
		}

		return this;
	}
}
