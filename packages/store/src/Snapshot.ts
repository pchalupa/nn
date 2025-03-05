import { EventEmitter } from "@nn/event-emitter";

export class Snapshot<State> {
	// TODO: Remove update type
	events = new EventEmitter<{ invalidated: []; update: [] }>();

	private constructor(private state: State) {}

	get id() {
		return this.state?.toString();
	}

	static createSnapshot<State>(state: State): Snapshot<State> {
		const snapshot = new Snapshot<State>(state);
		const handleUpdate = () => snapshot.events.emit("invalidated");

		snapshot.events.once("update", handleUpdate);

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
