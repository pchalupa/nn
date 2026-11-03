import { Codec } from "@nn/entities/Codec";
import type { Entity } from "@nn/entities/Entity";
import type { Unsubscribe } from "@nn/observable/Subject";
import type { Repository } from "@nn/repository";
import type { Store } from "@nn/store";
import type { Sync } from "@nn/sync";

export class RepositorySync implements Sync {
	private readonly codec = new Codec();
	private readonly held = new Map<string, Entity>();
	private readonly blocked = new Set<string>();
	private restoring = true;
	private attached = true;
	private unsubscribe: Unsubscribe;
	public readonly restored: Promise<void>;

	private constructor(
		private readonly store: Store,
		private readonly repository: Repository,
	) {
		this.unsubscribe = store.observe((changed) => {
			for (const entity of changed) {
				if (this.restoring) this.held.set(entity.key, entity);
				else this.write(entity);
			}
		});
		this.restored = this.restore();
		this.restored.catch(() => {});
	}

	public static attach(store: Store, repository: Repository): Sync {
		return new RepositorySync(store, repository);
	}

	public detach(): void {
		this.attached = false;
		this.unsubscribe();
		this.held.clear();
	}

	private write(entity: Entity): void {
		if (!this.blocked.has(entity.key)) void this.persist(entity);
	}

	private async persist(entity: Entity): Promise<void> {
		try {
			await this.repository.set(entity.key, this.codec.encode(entity));
		} catch (error) {
			console.error("Failed to persist Store record.", error);
		}
	}

	private async restore(): Promise<void> {
		try {
			await this.repository.init(this.store.schema.properties);
		} catch (error) {
			this.unsubscribe();
			this.held.clear();

			if (!this.attached) return;

			console.error("Failed to restore Store record.", error);

			throw error;
		}

		if (!this.attached) return;

		let failure: { error: unknown } | undefined;

		for (const name of Object.keys(this.store.schema.properties)) {
			try {
				const entry = await this.repository.get(name);

				if (!this.attached) return;

				if (entry) this.store.state.merge(name, this.codec.decode(entry));
			} catch (error) {
				if (!this.attached) return;

				console.error("Failed to restore Store record.", error);
				this.blocked.add(name);
				failure ??= { error };
			}
		}

		if (!this.attached) return;

		this.restoring = false;

		const held = [...this.held.values()];

		this.held.clear();

		for (const entity of held) this.write(entity);

		if (failure) throw failure.error;
	}
}
