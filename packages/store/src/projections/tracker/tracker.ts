import type { Entity } from "@nn/entities/entity";
import { isObject } from "@nn/guards/is-object";

import type { Trackers } from "./trackers";

export interface ReadonlyTracker {
	readonly entity: Entity;
	readonly proxy: object;
	readonly target: Record<string, unknown> | unknown[];
	readonly changed: readonly ReadonlyTracker[];
	readonly filled: boolean;
	readonly written: boolean;
	readonly dirty: boolean;
}

const self = Symbol("draft tracker");

export abstract class Tracker<
	Source extends Entity = Entity,
	Target extends Record<string, unknown> | unknown[] = Record<string, unknown> | unknown[],
>
	implements ReadonlyTracker, ProxyHandler<object>
{
	public readonly entity: Source;
	public readonly target: Target;
	public readonly trackers: Trackers;
	public readonly proxy: object;
	public filled = false;
	public written = false;
	public dirty = false;
	private parent: Tracker | undefined;
	private changes: Tracker[] = [];

	constructor(entity: Source, target: Target, parent: Tracker | undefined, trackers: Trackers) {
		this.entity = entity;
		this.target = target;
		this.parent = parent;
		this.trackers = trackers;
		this.proxy = new Proxy(target, this);
	}

	public get changed(): readonly Tracker[] {
		return this.changes;
	}

	public get(_target: object, key: string | symbol): unknown {
		if (key === self) return this;

		return this.settle(key);
	}

	public has(_target: object, key: string | symbol): boolean {
		this.fill();

		return Reflect.has(this.target, key);
	}

	public ownKeys(): ArrayLike<string | symbol> {
		this.fill();

		return Reflect.ownKeys(this.target);
	}

	public getOwnPropertyDescriptor(_target: object, key: string | symbol): PropertyDescriptor | undefined {
		this.settle(key);

		return Reflect.getOwnPropertyDescriptor(this.target, key);
	}

	public preventExtensions(): boolean {
		this.fill();

		for (const key of Object.keys(this.target)) this.settle(key);

		return Reflect.preventExtensions(this.target);
	}

	public set(_target: object, key: string | symbol, value: unknown): boolean {
		this.write();

		return Reflect.set(this.target, key, value);
	}

	public deleteProperty(_target: object, key: string | symbol): boolean {
		this.write();

		return Reflect.deleteProperty(this.target, key);
	}

	public defineProperty(_target: object, key: string | symbol, descriptor: PropertyDescriptor): boolean {
		this.write();
		this.settle(key);

		return Reflect.defineProperty(this.target, key, descriptor);
	}

	public fill(): void {
		if (this.filled) return;

		this.filled = true;
		this.seed();
	}

	protected abstract seed(): void;

	protected abstract deferred(key: string | symbol, value: unknown): value is Entity;

	protected track(entity: Entity): unknown {
		return this.trackers.track(entity, this);
	}

	private settle(key: string | symbol): unknown {
		this.fill();

		const value: unknown = Reflect.get(this.target, key);

		if (!this.deferred(key, value)) return value;

		const resolved = this.track(value);

		Reflect.set(this.target, key, resolved);

		return resolved;
	}

	private write(): void {
		this.fill();
		this.written = true;
		this.mark();
	}

	private mark(): void {
		if (this.dirty) return;

		this.dirty = true;

		if (this.parent) {
			this.parent.changes.push(this);
			this.parent.mark();
		}
	}

	public static is(value: unknown): value is Tracker {
		return value instanceof Tracker;
	}

	public static of(value: unknown): Tracker | undefined {
		if (isObject(value)) {
			const tracker: unknown = Reflect.get(value, self);

			if (Tracker.is(tracker)) return tracker;
		}
	}
}
