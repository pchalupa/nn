import type { Observable } from "@nn/event-emitter/Observable";
import { ID } from "@nn/id";

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

export abstract class Entity<Value = unknown> implements Observable<EntityDelegate>, Encodable {
	public delegate?: EntityDelegate;
	private changes = 0;
	private id: string;

	constructor(key?: string) {
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
}
