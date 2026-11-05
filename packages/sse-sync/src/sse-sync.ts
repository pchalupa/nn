import type { Encoded } from "@nn/entities/codable";
import { assertPlainObject } from "@nn/guards/assert-plain-object";
import { assertString } from "@nn/guards/assert-string";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

import { EventStream } from "./event-stream";

const reopenDelay = 3_000;

export class SseSync extends SyncEngine {
	private stream: EventStream;
	private reopening?: ReturnType<typeof setTimeout>;

	private constructor(
		store: Store,
		private readonly url: URL,
	) {
		super(store);

		this.stream = new EventStream(new URL(this.url.pathname.replace(/\/?$/, "/subscribe"), this.url));
		this.stream.delegate = {
			eventStreamDidReceive: (data) => {
				assertString(data);

				const entries: unknown = JSON.parse(data);

				assertPlainObject(entries, `Unexpected event from ${this.url}`);

				this.receive(entries);
			},
			eventStreamDidFail: (error) => this.delegate?.syncEngineDidFail(this, error),
			eventStreamDidClose: () => (this.reopening = setTimeout(() => this.session.reconnect(), reopenDelay)),
		};
	}

	protected async open(signal: AbortSignal): Promise<void> {
		await this.stream.open(signal);
	}

	protected close(): void {
		clearTimeout(this.reopening);
		this.stream.close();
	}

	protected async push(name: string, entry: Encoded): Promise<void> {
		const response = await fetch(new URL(this.url.pathname.replace(/\/?$/, "/push"), this.url), {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({ [name]: entry }),
		});

		if (!response.ok) this.delegate?.syncEngineDidFail(this, new Error(`Failed to push ${name} to ${this.url}`));
	}

	public static attach(store: Store, url: URL): SseSync {
		const sseSync = new SseSync(store, url);

		sseSync.session.connect();

		return sseSync;
	}
}
