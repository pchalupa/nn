import { ID } from "@nn/id";
import type { Delegatable } from "@nn/observable";

import type { Encodable, Encoded } from "./codable";

export type { Encoded } from "./codable";

export type InferValueType<Value> =
	Value extends Entity<infer Current>
		? Current extends object
			? { [Key in keyof Current]: InferValueType<Current[Key]> }
			: Current
		: Value;

export interface EntityDelegate {
	/** @param child Direct child the change bubbled up from, or `undefined` when `entity` itself changed. */
	entityDidChange(entity: Entity, child?: Entity): void;
}

/**
 * Base class of the replicated data types (CRDTs). Replicas change their own copies, and {@link Entity.merge} makes
 * them converge.
 *
 * @example
 * const local: Entity = new LWWMap({ title: new LWWRegister("Draft") }, "ticket");
 * const remote = new Codec().decode(JSON.parse(message));
 *
 * local.delegate = { entityDidChange: (_entity, child) => console.log("changed", child?.key) };
 * local.merge(remote);
 * JSON.stringify(local); // '{"title":"…"}'
 */
export abstract class Entity<Value = unknown> implements Delegatable<EntityDelegate>, Encodable {
	private id: string;
	// TODO: This should not be concert on entities. Consider moving it to state.
	private changes = 0;
	public readonly kind: string;
	public delegate?: EntityDelegate;

	constructor(kind: string, key: string = ID.create()) {
		this.kind = kind;
		this.id = key;
	}

	public get key(): string {
		return this.id;
	}

	public abstract get current(): Value;
	public abstract set current(value: Value);

	/** Merges a remote copy of this entity. Order and repetition of merges don't matter. */
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
