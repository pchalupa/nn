export type Observer<Arguments extends unknown[] = []> = (...args: Arguments) => void;

export type Unsubscribe = () => void;

export class Observable<Arguments extends unknown[] = []> {
	private observers = new Set<Observer<Arguments>>();

	public subscribe(observer: Observer<Arguments>): Unsubscribe {
		this.observers.add(observer);

		return () => this.unsubscribe(observer);
	}

	public unsubscribe(observer: Observer<Arguments>): void {
		this.observers.delete(observer);
	}

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
