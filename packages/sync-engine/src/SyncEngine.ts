import type { Encoded } from "@nn/entities/Codable";
import { Codec } from "@nn/entities/Codec";
import type { Entity } from "@nn/entities/Entity";
import type { Unsubscribe } from "@nn/observable/Observable";
import type { Store } from "@nn/store";

import { Outbox } from "./Outbox";

export abstract class SyncEngine {
	private codec = new Codec();
	private outbox = new Outbox((entity) => void this.send(entity));

	private unsubscribe?: Unsubscribe;

	protected constructor(protected readonly store: Store) {}

	protected abstract open(): Promise<void>;
	protected abstract close(): void;
	protected abstract pull(name: string): Promise<unknown>;
	protected abstract push(name: string, entry: Encoded): Promise<void>;

	protected attach(): void {
		this.unsubscribe = this.store.changes.subscribe((changed) => {
			for (const entity of changed) {
				this.outbox.add(entity);
			}
		});
		this.bootstrap();
	}

	public detach(): void {
		this.unsubscribe?.();
		this.close?.();
	}

	protected receive(entries: Record<string, unknown>): void {
		if (this.outbox.released) {
			for (const name of Object.keys(this.store.schema.properties)) {
				if (name in entries && !this.outbox.isBlocked(name)) {
					const entry = entries[name];

					this.store.state.merge(name, this.codec.decode(entry));
				}
			}
		}
	}

	private async send(entity: Entity): Promise<void> {
		const entry = this.codec.encode(entity);

		await this.push(entity.key, entry).catch(() => {});
	}

	private async bootstrap(): Promise<void> {
		try {
			await this.open();

			for (const name in this.store.schema.properties) {
				try {
					const value = await this.pull(name);

					if (value) {
						this.store.state.merge(name, this.codec.decode(value));
					}
				} catch {
					this.outbox.block(name);
				}
			}

			this.outbox.release();
		} catch {
			this.detach();
		}
	}
}
