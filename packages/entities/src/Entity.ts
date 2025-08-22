import { EventEmitter } from "@nn/event-emitter";
import type { Callback, Observable, Unsubscribe } from "@nn/event-emitter/Observable";

export class Entity implements Observable {
	private eventEmitter = new EventEmitter<{ update: [] }>();

	protected emit() {
		this.eventEmitter.emit("update");
	}

	subscribe(callback: Callback): Unsubscribe {
		this.eventEmitter.on("update", callback);

		return () => this.eventEmitter.off("update", callback);
	}
}
