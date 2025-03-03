import { EventEmitter } from "@nn/event-emitter";
import type { Collection } from "./Collection";

export class Snapshot<Type extends Collection<unknown>> extends EventEmitter<{ invalidated: [] }> {
	private constructor(private state: Type) {
		super();
	}

	get id() {
		return this.state.toString();
	}

	static createSnapshot<Type>(state: Type) {
		const snapshot = new Snapshot<Type>(state);

		const proxy = new Proxy(snapshot, {
			get(target, prop, receiver) {
				// Snapshot properties
				if (prop === "id" || prop === "state" || prop === "on") return Reflect.get(target, prop, receiver);

				return Reflect.get(target.state, prop, receiver);
			},
		});

		return proxy;
	}
}
