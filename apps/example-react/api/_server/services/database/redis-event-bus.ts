import { isPlainObject } from "@nn/guards/is-plain-object";
import { isString } from "@nn/guards/is-string";

import type { EventBus } from "./memory-event-bus";

export interface RedisSubscriberEvents {
	message: { message: unknown };
	subscribe: number;
	error: Error;
}

export interface RedisSubscriber {
	on<T extends keyof RedisSubscriberEvents>(type: T, listener: (event: RedisSubscriberEvents[T]) => void): void;
	unsubscribe(): Promise<void>;
}

export interface RedisPubSubClient {
	publish(channel: string, message: string): Promise<unknown>;
	subscribe(channel: string): RedisSubscriber;
}

export function createRedisEventBus(client: RedisPubSubClient, channel = "nn-example"): EventBus {
	return {
		publish: async (data) => {
			await client.publish(channel, JSON.stringify(data));
		},
		subscribe: (listener, onError) =>
			new Promise((resolve, reject) => {
				const subscriber = client.subscribe(channel);

				subscriber.on("message", ({ message }) => {
					const data: unknown = isString(message) ? JSON.parse(message) : message;

					if (isPlainObject(data)) listener(data);
					else onError(new TypeError(`Unexpected message on "${channel}"`));
				});
				subscriber.on("error", reject);
				subscriber.on("subscribe", () => {
					subscriber.on("error", onError);
					resolve(() => void subscriber.unsubscribe());
				});
			}),
	};
}
