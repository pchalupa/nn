import { EventEmitter } from "@nn/event-emitter";
import type { Observable } from "@nn/event-emitter/Observable";

export class Snapshot {
	events = new EventEmitter<{ invalidated: [] }>();

	constructor(public readonly state: Observable) {
		state.subscribe(() => this.invalidate());
	}

	get id(): string | undefined {
		return JSON.stringify(this.state);
	}

	invalidate(): void {
		this.events.emit("invalidated");
	}
}
