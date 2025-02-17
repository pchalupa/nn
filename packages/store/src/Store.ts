import type { Subscribers } from "./Subscribers";

export class Store<Schema extends object> {
	constructor(
		private _schema: Schema,
		private subscribers: Subscribers,
	) {}

	get schema() {
		return this._schema;
	}

	addSubscriber(key: string, listener: () => void) {
		this.subscribers.set(key, listener);
	}

	removeSubscriber(key: string) {
		this.subscribers.delete(key);
	}

	notifySubscribers() {
		this.subscribers.forEach((listener) => listener());
	}
}
