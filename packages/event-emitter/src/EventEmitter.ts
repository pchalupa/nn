type Listener<Arguments extends unknown[]> = (...args: Arguments) => void;

export class EventEmitter<Emits extends Record<string, unknown[]>, Event extends keyof Emits = keyof Emits> {
	private events = new Map<Event, Set<Listener<Emits[Event]>>>();

	emit(event: Event, ...args: Emits[Event]): void {
		this.events.get(event)?.forEach((listener) => listener(...args));
	}

	on(event: Event, listener: Listener<Emits[Event]>): void {
		const listeners = this.events.get(event) ?? new Set();

		listeners?.add(listener);

		this.events.set(event, listeners);
	}

	once(event: Event, listener: Listener<Emits[Event]>): void {
		const once: typeof listener = (...args) => {
			listener(...args);

			this.off(event, once);
		};

		this.on(event, once);
	}

	off(event: Event, listener: Listener<Emits[Event]>): void {
		this.events.get(event)?.delete(listener);
	}
}
