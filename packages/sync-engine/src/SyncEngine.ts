import type { Encoded } from "@nn/entities/Codable";
import { Codec } from "@nn/entities/Codec";
import type { Entity } from "@nn/entities/Entity";
import type { Delegatable } from "@nn/observable";
import type { Store } from "@nn/store";

export interface SyncEngineDelegate {
	syncEngineDidFailToPush(syncEngine: SyncEngine, error: unknown): void;
}

export abstract class SyncEngine implements Delegatable<SyncEngineDelegate> {
	public delegate?: SyncEngineDelegate;
	private codec = new Codec();

	private unsubscribeFromStoreChanges?: () => void;

	protected constructor(protected readonly store: Store) {}

	protected abstract open(): Promise<void>;
	protected abstract close(): void;
	protected abstract pull(name: string): Promise<unknown>;
	protected abstract push(name: string, entry: Encoded): Promise<void>;

	protected async attach(): Promise<void> {
		try {
			await this.open();

			this.unsubscribeFromStoreChanges = this.store.changes.subscribe((changed) => {
				for (const entity of changed) {
					void this.send(entity);
				}
			});

			for (const name in this.store.schema.properties) {
				const value = await this.pull(name);

				if (value) {
					const entity = this.codec.decode(value);

					this.store.state.merge(name, entity);
				}
			}
		} catch {
			this.detach();
		}
	}

	public detach(): void {
		this.unsubscribeFromStoreChanges?.();
		this.close();
	}

	protected receive(entries: Record<string, unknown>): void {
		for (const name of Object.keys(this.store.schema.properties)) {
			if (Object.hasOwn(entries, name)) {
				this.store.state.merge(name, this.codec.decode(entries[name]));
			}
		}
	}

	private async send(entity: Entity): Promise<void> {
		const entry = this.codec.encode(entity);

		try {
			await this.push(entity.key, entry);
		} catch (error) {
			this.delegate?.syncEngineDidFailToPush(this, error);
		}
	}
}
