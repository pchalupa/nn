import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";
import { ID } from "@nn/id";

export abstract class Entity<Value = unknown> implements Observable {
	private eventEmitter = new EventEmitter<{ change: [] }>();
	private changes = 0;
	private id: string;

	constructor(key?: string) {
		this.id = key ?? ID.create();
	}

	public get key(): string {
		return this.id;
	}

	public abstract get current(): Value;
	public abstract set current(value: Value);

	public abstract merge(remote: Entity): Entity;

	// TBD: this leans more towards Store/State concern.
	public get revision(): number {
		return this.changes;
	}

	// TODO: Infer event names from event emitter. Consider a generic type to entity.
	protected emit(event: "change"): void {
		// TODO: this placement is odd, currently "changed" events is ok, but will break in the future.
		this.changes++;
		this.eventEmitter.emit(event);
	}

	public set(updater: (current: Value) => Value): void {
		this.current = updater(this.current);
	}

	public subscribe(callback: Callback): Unsubscribe {
		this.eventEmitter.on("change", callback);

		return () => this.eventEmitter.off("change", callback);
	}

	public toJSON(): Value {
		return this.current;
	}
}
