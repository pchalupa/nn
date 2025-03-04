import { EventEmitter } from "@nn/event-emitter";

export class Snapshot<State> {
	// Temporary solution
	readonly id = Math.random().toString(36).slice(2);
	events = new EventEmitter<{ invalidated: [] }>();

	private constructor(private state: State) {}

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
