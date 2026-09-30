import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";

export abstract class Entity<Value = unknown> implements Observable {
	private eventEmitter = new EventEmitter<{ change: [] }>();
	private changes = 0;

	abstract get current(): Value;
	abstract set current(value: Value);

	abstract merge(remote: Entity): Entity;

	// TBD: this leans more towards Store/State concern.
	get revision(): number {
		return this.changes;
	}

	// TODO: Infer event names from event emitter. Consider a generic type to entity.
	protected emit(event: "change") {
		// TODO: this placement is odd, currently "changed" events is ok, but will break in the future.
		this.changes++;
		this.eventEmitter.emit(event);
	}

	set(updater: (current: Value) => Value): void {
		this.current = updater(this.current);
	}

	subscribe(callback: Callback): Unsubscribe {
		this.eventEmitter.on("change", callback);

		return () => this.eventEmitter.off("change", callback);
	}

	toJSON() {
		return this.current;
	}
}
