export type Observer = () => void;

export type Unsubscribe = () => void;

export class Subject {
	private observers = new Set<Observer>();

	public subscribe(observer: Observer): Unsubscribe {
		this.observers.add(observer);

		return () => this.unsubscribe(observer);
	}

	public unsubscribe(observer: Observer): void {
		this.observers.delete(observer);
	}

	public notify(): void {
		for (const observer of this.observers) observer();
	}
}
