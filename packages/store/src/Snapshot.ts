import { EventEmitter } from "@nn/event-emitter";

export class Snapshot<State> {
	events = new EventEmitter<{ invalidated: [] }>();

	private constructor(private state: State) {}

	get id() {
		return this.state?.toString();
	}

	static createSnapshot<State>(state: State) {
		const snapshot = new Snapshot<State>(state);

		const proxy = new Proxy(snapshot, {
			get(target, prop, receiver) {
				// Snapshot properties
				if (prop === "id" || prop === "state" || prop === "on") return Reflect.get(target, prop, receiver);

				if (target.state instanceof Object) return Reflect.get(target.state, prop, receiver);
			},
		});

		return proxy;
	}
}
