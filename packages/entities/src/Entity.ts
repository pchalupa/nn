import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";

export abstract class Entity<Value = unknown> implements Observable {
	private eventEmitter = new EventEmitter<{ update: [] }>();
	abstract get current(): Value;
	abstract set current(value: Value);

	abstract merge(remote: Entity): Entity;
	protected emit() {
		this.eventEmitter.emit("update");
	}

	subscribe(callback: Callback): Unsubscribe {
		this.eventEmitter.on("update", callback);

		return () => this.eventEmitter.off("update", callback);
	}
}
