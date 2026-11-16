import type { Entity } from "@nn/entities/entity";
import type { RGA } from "@nn/entities/kinds/rga";

import type { Reader, Tracker } from "./tracker";

export class ListReader implements Reader {
	public readonly target: unknown[] = [];
	private rows: readonly Entity[] | undefined;

	constructor(public readonly entity: RGA<Entity>) {}

	public peek(key: string | symbol, tracker: Tracker): unknown {
		if (key === "length") return this.rows?.length ?? this.entity.size;

		if (this.isIndex(key)) {
			const row = this.snapshot()[Number(key)];

			if (row) return tracker.read(row);
		}
	}

	public seed(tracker: Tracker): void {
		for (const row of this.snapshot()) this.target.push(tracker.placeholder(row));
	}

	public pending(key: string | symbol, value: unknown): value is Entity {
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
