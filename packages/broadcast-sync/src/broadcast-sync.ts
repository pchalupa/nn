import type { Encoded } from "@nn/entities/codable";
import { isObject } from "@nn/guards/is-object";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

export class BroadcastSync extends SyncEngine {
	private channel?: BroadcastChannel;
	private entries: Record<string, Encoded> = {};

	private constructor(
		store: Store,
		private readonly name: string,
	) {
		super(store);
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

	protected async pull(): Promise<void> {}

	protected async push(name: string, entry: Encoded): Promise<void> {
		this.entries[name] = entry;
		this.channel?.postMessage({ type: "entries", entries: { [name]: entry } });
	}

	public static attach(store: Store, name = "nn-default"): BroadcastSync {
		const broadcastSync = new BroadcastSync(store, name);

		broadcastSync.attach();

		return broadcastSync;
	}
}
