// TODO: Consider turning this into a decorator
export class EventEmitter<Event extends Record<string, unknown[]>, Name extends keyof Event = keyof Event> {
	private events = new Map<Name, Set<(...args: Event[Name]) => void>>();

	protected emit(event: Name, ...args: Event[Name]): void {
		// biome-ignore lint/complexity/noForEach: for each over map
		this.events.get(event)?.forEach((listener) => listener(...args));
	}

	on(event: Name, listener: (...args: Event[Name]) => void): void {
		const listeners = this.events.get(event) ?? new Set();

		listeners?.add(listener);
		this.events.set(event, listeners);
	}

	off(event: Name, listener: (...args: Event[Name]) => void): void {
		this.events.get(event)?.delete(listener);
	}
}
