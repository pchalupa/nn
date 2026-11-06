import EventEmitter from "events";

type Listener = (data: Record<string, unknown>) => void;

export interface EventBus {
	publish(data: Record<string, unknown>): Promise<void>;
	subscribe(listener: Listener, onError: (error: Error) => void): Promise<() => void>;
}

export function createMemoryEventBus(): EventBus {
	const events = new EventEmitter();

	return {
		publish: async (data) => {
			events.emit("update", data);
		},
		subscribe: async (listener) => {
			events.addListener("update", listener);

			return () => events.removeListener("update", listener);
		},
	};
}
