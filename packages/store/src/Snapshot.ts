import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";

export class Snapshot<State extends Observable> {
	events = new EventEmitter<{ invalidated: [] }>();

	private constructor(private state: State) {}

	get id() {
		return this.state?.toString();
	}

	static createSnapshot<State extends Observable>(state: State): Snapshot<State> {
		const snapshot = new Snapshot<State>(state);

		// On state update, snapshot has to be invalidated
		state.subscribe(() => {
			snapshot.events.emit("invalidated");
		});

		const proxy = new Proxy(snapshot, {
			get(target, prop, receiver) {
				// Snapshot properties
				if (prop === "id" || prop === "state" || prop === "events") {
					return Reflect.get(target, prop, receiver);
				}

				if (target.state instanceof Object && prop in target.state) return Reflect.get(target.state, prop, receiver);

				return undefined;
			},
		});

		return proxy;
	}
}
