import { SyncEngine } from "@nn/sync-engine";
import type { Replica } from "@nn/sync-engine/replica";

import { type EntriesMessage, isEntriesMessage } from "./entries-message";

/**
 * Syncs replicas across browser tabs through a `BroadcastChannel`.
 *
 * @example
 * new BroadcastSync(store, "my-app").connect();
 */
export class BroadcastSync extends SyncEngine {
	private name: string;
	private channel?: BroadcastChannel;

	constructor(replica: Replica, name = "nn-default") {
		super(replica);

		this.name = name;
	}

	protected async open(): Promise<void> {
		this.channel = new BroadcastChannel(this.name);
		this.channel.onmessage = (event: MessageEvent<unknown>) => {
			if (isEntriesMessage(event.data)) {
				try {
					this.receive(event.data.entries);
				} catch (error) {
					this.errors.notify(error);
				}
			}
		};
	}

	protected close(): void {
		this.channel?.close();
	}

	protected async push(name: string, entry: unknown): Promise<void> {
		const message: EntriesMessage = { type: "entries", entries: { [name]: entry } };

		this.channel?.postMessage(message);
	}
}
