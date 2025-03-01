type Listener<Arguments extends unknown[]> = (...args: Arguments) => void;

// TODO: Consider turning this into a decorator @Emits
export class EventEmitter<Emits extends Record<string, unknown[]>, Event extends keyof Emits = keyof Emits> {
	// Consider WeakSet for listeners
	private events = new Map<Event, Set<Listener<Emits[Event]>>>();

	emit(event: Event, ...args: Emits[Event]): void {
		// biome-ignore lint/complexity/noForEach: for each over map
		this.events.get(event)?.forEach((listener) => listener(...args));
	}

	on(event: Event, listener: Listener<Emits[Event]>): void {
		const listeners = this.events.get(event) ?? new Set();

		listeners?.add(listener);

		this.events.set(event, listeners);
	}

	once(event: Event, listener: Listener<Emits[Event]>): void {
		const onceListener = (...args: Emits[Event]) => {
			listener(...args);
			this.off(event, onceListener);
		};

		this.on(event, onceListener);
	}

	off(event: Event, listener: Listener<Emits[Event]>): void {
		this.events.get(event)?.delete(listener);
	}
}
