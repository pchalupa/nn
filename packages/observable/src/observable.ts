export type Observer<Arguments extends unknown[] = []> = (...args: Arguments) => void;

export type Unsubscribe = () => void;

/**
 * Synchronous publish and subscribe for any number of observers.
 *
 * @example
 * const changes = new Observable<[state: string]>();
 * const unsubscribe = changes.subscribe((state) => console.log(state));
 *
 * changes.notify("connected"); // logs "connected"
 * unsubscribe();
 */
export class Observable<Arguments extends unknown[] = []> {
	private observers = new Set<Observer<Arguments>>();

	/** Subscribing the same observer twice keeps one subscription */
	public subscribe(observer: Observer<Arguments>): Unsubscribe {
		this.observers.add(observer);

		return () => this.unsubscribe(observer);
	}

	public unsubscribe(observer: Observer<Arguments>): void {
		this.observers.delete(observer);
	}

	/** Calls every observer, then rethrows the first error any of them threw */
	public notify(...args: Arguments): void {
		const errors: unknown[] = [];

		for (const observer of this.observers) {
			try {
				observer(...args);
			} catch (error) {
				errors.push(error);
			}
		}

		if (errors.length > 0) throw errors[0];
	}
}
