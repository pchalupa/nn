import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";

export class Snapshot<State extends Observable> {
	events = new EventEmitter<{ invalidated: [] }>();

	private constructor(public readonly state: State) {}

	get id(): string | undefined {
		return this.state?.toString();
	}

	static createSnapshot<State extends Observable>(state: State): Snapshot<State> {
		const snapshot = new Snapshot<State>(state);

		// On state update, snapshot has to be invalidated
		state.subscribe(() => {
			snapshot.events.emit("invalidated");
		});

		return snapshot;
	}
}
