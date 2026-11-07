import type { Encoded } from "@nn/entities/codable";
import { Codec } from "@nn/entities/codec";
import type { Delegatable } from "@nn/observable";
import type { Store } from "@nn/store";

import { Session } from "./session";

export { SessionState } from "./session";

export interface SyncEngineDelegate {
	syncEngineDidFail(syncEngine: SyncEngine, error: unknown): void;
}

export abstract class SyncEngine implements Delegatable<SyncEngineDelegate> {
	private codec = new Codec();
	public delegate?: SyncEngineDelegate;
	public readonly session = new Session();

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

							if (value) this.store.state.merge(key, this.codec.decode(value));
						}
					}
				} catch (error) {
					if (!signal.aborted) {
						this.delegate?.syncEngineDidFail(this, error);
						this.session.drop();
					}
				}
			},
			sessionDidOpen: () => {
				const { data } = this.store.state.encode();
				const entries = Object.values(data);

				void this.send(entries);

				unsubscribeFromStoreChanges = this.store.changes.subscribe((changed) => {
					void this.send(Array.from(changed, (entity) => this.codec.encode(entity)));
				});
			},
			sessionDidClose: () => {
				unsubscribeFromStoreChanges?.();
				this.close();
			},
		};
	}

	protected abstract open(signal: AbortSignal): Promise<void>;
	protected abstract close(): void;
	protected pull?(name: string): Promise<unknown>;
	protected abstract push(name: string, entry: Encoded): Promise<void>;

	protected receive(entries: Record<string, unknown>): void {
		for (const name in this.store.schema.properties) {
			if (Object.hasOwn(entries, name)) {
				this.store.state.merge(name, this.codec.decode(entries[name]));
			}
		}
	}

	private async send(entries: Encoded[]): Promise<void> {
		await Promise.all(
			entries.map(async (entry) => {
				try {
					await this.push(entry.key, entry);
				} catch (error) {
					this.delegate?.syncEngineDidFail(this, error);
				}
			}),
		);
	}
}
