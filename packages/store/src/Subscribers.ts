export class Subscribers {
	private subscribers = new Map<string, () => void>();

	set(key: string, listener: () => void) {
		this.subscribers.set(key, listener);
	}

	delete(key: string) {
		this.subscribers.delete(key);
	}

	forEach(callback: (listener: () => void, key: string) => void) {
		this.subscribers.forEach(callback);
	}
}
