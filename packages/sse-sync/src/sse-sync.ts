import type { Encoded } from "@nn/entities/codable";
import { assertPlainObject } from "@nn/guards/assert-plain-object";
import { assertString } from "@nn/guards/assert-string";
import type { Store } from "@nn/store";
import { SyncEngine } from "@nn/sync-engine";

import { EventStream } from "./event-stream";

export class SseSync extends SyncEngine {
	private stream: EventStream;

	constructor(
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
			eventStreamDidFail: (error) => this.errors.notify(error),
			eventStreamDidClose: () => this.session.drop(),
		};
	}

	protected async open(signal: AbortSignal): Promise<void> {
		await this.stream.open(signal);
	}

	protected close(): void {
		this.stream.close();
	}

	protected async push(name: string, entry: Encoded): Promise<void> {
		const response = await fetch(new URL(this.url.pathname.replace(/\/?$/, "/push"), this.url), {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({ [name]: entry }),
		});

		if (!response.ok) this.errors.notify(new Error(`Failed to push ${name} to ${this.url}`));
	}
}
