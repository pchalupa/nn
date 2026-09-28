import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";

export abstract class Entity<Value = unknown> implements Observable {
	private eventEmitter = new EventEmitter<{ update: [] }>();
	private changes = 0;

	abstract get current(): Value;
	abstract set current(value: Value);

	abstract merge(remote: Entity): Entity;

	/**
	 * Local only changes counter.
	 * TBD: Consider an CRDT native "compare" method
	 * */
	get version(): number {
		return this.changes;
	}

	protected emit() {
		this.changes++;
		this.eventEmitter.emit("update");
	}

	set(updater: (current: Value) => Value): void {
		this.current = updater(this.current);
	}

	subscribe(callback: Callback): Unsubscribe {
		this.eventEmitter.on("update", callback);

		return () => this.eventEmitter.off("update", callback);
	}

	toJSON() {
		return this.current;
	}
}
