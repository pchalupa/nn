import { assertPlainObject } from "@goodstate/guards/assert-plain-object";
import { assertString } from "@goodstate/guards/assert-string";
import { SyncEngine } from "@goodstate/sync-engine";
import type { Replica } from "@goodstate/sync-engine/replica";

import { EventStream } from "./event-stream";

/**
 * Syncs a replica with a server.
 *
 * @example
 * new SseSync(store, new URL("/sync", location.origin)).connect();
 */
export class SseSync extends SyncEngine {
	private readonly url: URL;
	private stream: EventStream;

	constructor(replica: Replica, url: URL) {
		super(replica);

		this.url = url;
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

	protected async push(name: string, entry: unknown): Promise<void> {
		const response = await fetch(new URL(this.url.pathname.replace(/\/?$/, "/push"), this.url), {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify({ [name]: entry }),
		});

		if (!response.ok) this.errors.notify(new Error(`Failed to push ${name} to ${this.url}`));
	}
}
