import type { Entity } from "@nn/entities/entity";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";

import { ListReader } from "./list-reader";
import { MapReader } from "./map-reader";

export interface ReadonlyTracker {
	readonly entity: Entity;
	readonly proxy: object;
	readonly target: Record<string, unknown> | unknown[];
	readonly changed: readonly ReadonlyTracker[];
	readonly filled: boolean;
	readonly written: boolean;
	readonly modified: boolean;
}

export interface Reader {
	readonly entity: Entity;
	readonly target: Record<string, unknown> | unknown[];
	peek(key: string | symbol, tracker: Tracker): unknown;
	seed(tracker: Tracker): void;
	pending(key: string | symbol, value: unknown): value is Entity;
}

const own = Symbol("draft tracker");
const none: readonly Tracker[] = [];

function copy(value: unknown): unknown {
	if (isArray(value)) return [...value];

	return isObject(value) ? { ...value } : value;
}

export class Tracker implements ReadonlyTracker, ProxyHandler<object> {
	public readonly entity: Entity;
	public readonly target: Record<string, unknown> | unknown[];
	public readonly proxy: object;
	public filled = false;
	public written = false;
	public modified = false;
	private children: Tracker[] | undefined;

	constructor(
		private readonly reader: Reader,
		private readonly parent: Tracker | undefined,
		public readonly trackers: Map<Entity, Tracker>,
	) {
		this.entity = reader.entity;
		this.target = reader.target;
		this.proxy = new Proxy(this.target, this);

		trackers.set(this.entity, this);
	}

	public static of(value: unknown): Tracker | undefined {
		const tracker: unknown = isObject(value) ? Reflect.get(value, own) : undefined;

		return tracker instanceof Tracker ? tracker : undefined;
	}

	public static track(entity: Entity, parent: Tracker | undefined, trackers: Map<Entity, Tracker>): unknown {
		if (RGA.is(entity)) return new Tracker(new ListReader(entity), parent, trackers).proxy;

		if (LWWMap.is(entity)) return new Tracker(new MapReader(entity), parent, trackers).proxy;

		return copy(entity.current);
	}

	public get changed(): readonly Tracker[] {
		return this.children ?? none;
	}

	public get(_target: object, key: string | symbol, receiver: unknown): unknown {
		if (key === own) return this;

		if (!this.filled) {
			const peeked = this.reader.peek(key, this);

			if (peeked !== undefined) return peeked;
		}

		const value: unknown = Reflect.get(this.real(), key, receiver);

		return this.reader.pending(key, value) ? this.resolve(key, value) : value;
	}

	public has(_target: object, key: string | symbol): boolean {
		return Reflect.has(this.real(), key);
	}

	public ownKeys(): ArrayLike<string | symbol> {
		return Reflect.ownKeys(this.real());
	}

	public getOwnPropertyDescriptor(_target: object, key: string | symbol): PropertyDescriptor | undefined {
		const target = this.real();

		this.settle(key);

		return Reflect.getOwnPropertyDescriptor(target, key);
	}

	public preventExtensions(): boolean {
		const target = this.real();

		for (const key of Object.keys(target)) this.settle(key);

		return Reflect.preventExtensions(target);
	}

	public set(_target: object, key: string | symbol, value: unknown): boolean {
		return Reflect.set(this.write(), key, value);
	}

	public deleteProperty(_target: object, key: string | symbol): boolean {
		return Reflect.deleteProperty(this.write(), key);
	}

	public defineProperty(_target: object, key: string | symbol, descriptor: PropertyDescriptor): boolean {
		const target = this.write();

		this.settle(key);

		return Reflect.defineProperty(target, key, descriptor);
	}

	public fill(): void {
		if (this.filled) return;

		this.filled = true;
		this.reader.seed(this);
	}

	public placeholder(entity: Entity): unknown {
		if (LWWRegister.is(entity)) return copy(entity.current);

		return this.trackers.get(entity)?.proxy ?? entity;
	}

	public read(entity: Entity): unknown {
		return this.trackers.get(entity)?.proxy ?? Tracker.track(entity, this, this.trackers);
	}

	private settle(key: string | symbol): void {
		const value: unknown = Reflect.get(this.target, key);

		if (this.reader.pending(key, value)) this.resolve(key, value);
	}

	private resolve(key: string | symbol, entity: Entity): unknown {
		const value = this.read(entity);

		Reflect.set(this.target, key, value);

		return value;
	}

	private real(): object {
		this.fill();

		return this.target;
	}

	private write(): object {
		const target = this.real();

		this.written = true;
		this.mark();

		return target;
	}

	private mark(): void {
		if (!this.modified) {
			this.modified = true;
			this.parent?.adopt(this);
		}
	}

	private adopt(child: Tracker): void {
		(this.children ??= []).push(child);
		this.mark();
	}
}
