import type { Encoded } from "@nn/entities/codable";
import { isObject } from "@nn/guards/is-object";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

export class BroadcastSync extends SyncEngine {
	private name: string;
	private channel?: BroadcastChannel;
	private entries: Record<string, Encoded> = {};

	constructor(store: Store, name = "nn-default") {
		super(store);

		this.name = name;
	}

	protected async open(): Promise<void> {
		this.channel = new BroadcastChannel(this.name);
		this.channel.onmessage = (event: MessageEvent<unknown>) => {
			if (isObject(event.data) && event.data.type === "entries" && isObject(event.data.entries)) {
				this.receive(event.data.entries);
			}
		};
	}

	protected close(): void {
		this.channel?.close();
	}

	protected async push(name: string, entry: Encoded): Promise<void> {
		this.entries[name] = entry;
		this.channel?.postMessage({ type: "entries", entries: { [name]: entry } });
	}
}
