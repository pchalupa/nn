import type { Entity } from "@nn/entities/entity";
import type { RGA } from "@nn/entities/kinds/rga";

import { Tracker } from "./tracker";

export class ListTracker extends Tracker<RGA<Entity>, unknown[]> {
	private rows: readonly Entity[] | undefined;

	public override get(target: object, key: string | symbol, receiver: unknown): unknown {
		if (!this.filled) {
			if (key === "length") return this.rows?.length ?? this.entity.size;

			if (this.isIndex(key)) {
				const row = this.snapshot()[Number(key)];

				if (row) return this.read(row);
			}
		}

		return super.get(target, key, receiver);
	}

	protected seed(): void {
		for (const row of this.snapshot()) this.target.push(this.placeholder(row));
	}

	protected pending(key: string | symbol, value: unknown): value is Entity {
		return typeof value === "object" && this.isIndex(key) && this.rows?.[Number(key)] === value;
	}

	private isIndex(key: string | symbol): key is string {
		const index = /^(?:0|[1-9]\d*)$/;

		return typeof key === "string" && index.test(key);
	}

	private snapshot(): readonly Entity[] {
		this.rows ??= this.entity.current;

		return this.rows;
	}
}
