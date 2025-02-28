import { EventEmitter } from "@nn/event-emitter";
import type { Collection } from "./schema/Collection";

export class Snapshot<Type extends Collection<unknown>> extends EventEmitter<{ invalidated: [] }> {
	private constructor(private state: Type) {
		super();
	}

	get id() {
		return this.state.toString();
	}

	static createSnapshot<Type extends Collection<unknown>>(state: Type) {
		const snapshot = new Snapshot<Type>(state);

		const proxy = new Proxy(snapshot, {
			get(target, prop, receiver) {
				// Snapshot properties
				if (prop === "id" || prop === "state") return Reflect.get(target, prop, receiver);

				return Reflect.get(target.state, prop, receiver);
			},
		});

		return proxy;
	}
}
