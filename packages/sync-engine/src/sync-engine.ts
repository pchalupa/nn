import type { Encoded } from "@nn/entities/codable";
import { Observable, type Unsubscribe } from "@nn/observable/observable";
import type { Store } from "@nn/store";

import { Session, type SessionState } from "./session";

export { SessionState as SyncState } from "./session";

export abstract class SyncEngine {
	protected readonly session = new Session();
	protected readonly errors = new Observable<[unknown]>();

	constructor(protected readonly store: Store) {
		let unsubscribeFromStoreChanges: () => void | undefined;

		this.session.delegate = {
			sessionOpen: async (_session, signal) => {
				try {
					await this.open(signal);

					if (!signal.aborted && this.pull) {
						for (const key in this.store.schema.properties) {
							const value = await this.pull(key);

							if (signal.aborted) break;

							if (value) this.store.merge(key, value);
						}
					}
				} catch (error) {
					if (!signal.aborted) {
						this.errors.notify(error);
						this.session.drop();
					}
				}
			},
			sessionDidOpen: () => {
				const { data } = this.store.encode();
				const entries = Object.values(data);

				void this.send(entries);

				unsubscribeFromStoreChanges = this.store.onChange((changes) => void this.send(Object.values(changes)));
			},
			sessionDidClose: () => {
				unsubscribeFromStoreChanges?.();
				this.close();
			},
		};
	}

	public get state(): SessionState {
		return this.session.state;
	}

	public get idle(): boolean {
		return this.session.idle;
	}

	public get connecting(): boolean {
		return this.session.connecting;
	}

	public get connected(): boolean {
		return this.session.connected;
	}

	public get disconnected(): boolean {
		return this.session.disconnected;
	}

	public get detached(): boolean {
		return this.session.detached;
	}

	public connect(): void {
		this.session.connect();
	}

	public retry(): void {
		this.session.retry();
	}

	public detach(): void {
		this.session.detach();
	}

	public onStateChange(listener: (state: SessionState) => void): Unsubscribe {
		return this.session.changes.subscribe(listener);
	}

	public onError(listener: (error: unknown) => void): Unsubscribe {
		return this.errors.subscribe(listener);
	}

	protected abstract open(signal: AbortSignal): Promise<void>;
	protected abstract close(): void;
	protected pull?(name: string): Promise<unknown>;
	protected abstract push(name: string, entry: Encoded): Promise<void>;

	protected receive(entries: Record<string, unknown>): void {
		for (const name in this.store.schema.properties) {
			if (Object.hasOwn(entries, name)) {
				this.store.merge(name, entries[name]);
			}
		}
	}

	private async send(entries: Encoded[]): Promise<void> {
		await Promise.all(
			entries.map(async (entry) => {
				try {
					await this.push(entry.key, entry);
				} catch (error) {
					this.errors.notify(error);
				}
			}),
		);
	}
}
