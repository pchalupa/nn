import type { Entity } from "@nn/entities/entity";
import type { RGA } from "@nn/entities/kinds/rga";

import { Tracker } from "./tracker";

/** Tracks a list in a draft */
export class ListTracker extends Tracker<RGA<Entity>, unknown[]> {
	private items: readonly Entity[] | undefined;

	public override get(target: object, key: string | symbol): unknown {
		if (!this.filled) {
			if (key === "length") return this.items?.length ?? this.entity.size;

			if (this.isIndex(key)) {
				const item = this.snapshot()[Number(key)];

				if (item) return this.track(item);
			}
		}

		return super.get(target, key);
	}

	protected seed(): void {
		for (const item of this.snapshot()) this.target.push(this.trackers.defer(item));
	}

	protected deferred(key: string | symbol, value: unknown): value is Entity {
		return typeof value === "object" && this.isIndex(key) && this.items?.[Number(key)] === value;
	}

	private isIndex(key: string | symbol): key is string {
		const index = /^(?:0|[1-9]\d*)$/;

		return typeof key === "string" && index.test(key);
	}

	private snapshot(): readonly Entity[] {
		this.items ??= this.entity.current;

		return this.items;
	}
}
