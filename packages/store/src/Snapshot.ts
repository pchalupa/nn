import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";

export class Snapshot {
	events = new EventEmitter<{ invalidated: [] }>();

	private constructor(public readonly state: Observable) {}

	get id(): string | undefined {
		return this.state?.toString();
	}

	static createSnapshot(state: Observable): Snapshot {
		const snapshot = new Snapshot(state);

		// On state update, snapshot has to be invalidated
		state.subscribe(() => {
			snapshot.events.emit("invalidated");
		});

		return snapshot;
	}
}
