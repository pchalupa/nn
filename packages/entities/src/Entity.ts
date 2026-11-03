import { ID } from "@nn/id";
import type { Delegatable } from "@nn/observable";

import type { Encodable, Encoded } from "./Codable";

export type { Encoded } from "./Codable";

export type InferValueType<Value> =
	Value extends Entity<infer Current>
		? Current extends object
			? { [Key in keyof Current]: InferValueType<Current[Key]> }
			: Current
		: Value;

export interface EntityDelegate {
	entityDidChange(entity: Entity, child?: Entity): void;
}

export abstract class Entity<Value = unknown> implements Delegatable<EntityDelegate>, Encodable {
	private id: string;
	private changes = 0;
	public delegate?: EntityDelegate;

	constructor(
		public readonly kind: string,
		key?: string,
	) {
		this.id = key ?? ID.create();
	}

	public get key(): string {
		return this.id;
	}

	public abstract get current(): Value;
	public abstract set current(value: Value);

	public abstract merge(remote: Entity): Entity;

	public abstract encode(): Encoded;

	// TBD: this leans more towards Store/State concern.
	public get revision(): number {
		return this.changes;
	}

	protected didChange(child?: Entity): void {
		this.changes++;
		this.delegate?.entityDidChange(this, child);
	}

	public set(updater: (current: Value) => Value): void {
		this.current = updater(this.current);
	}

	public toJSON(): Value {
		return this.current;
	}

	public static is(entity: unknown): entity is Entity {
		return entity instanceof Entity;
	}

	public static assert(entity: unknown): asserts entity is Entity {
		if (!Entity.is(entity)) throw new TypeError("Invalid entity.");
	}
}
