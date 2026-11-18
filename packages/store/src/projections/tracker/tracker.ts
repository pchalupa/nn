import type { Entity } from "@nn/entities/entity";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { isArray } from "@nn/guards/is-array";
import { isObject } from "@nn/guards/is-object";

export interface ReadonlyTracker {
	readonly entity: Entity;
	readonly proxy: object;
	readonly target: Record<string, unknown> | unknown[];
	readonly changed: readonly ReadonlyTracker[];
	readonly filled: boolean;
	readonly written: boolean;
	readonly modified: boolean;
}

export type Track = (entity: Entity, parent: Tracker) => unknown;

const own = Symbol("draft tracker");
const none: readonly Tracker[] = [];

export function copy(value: unknown): unknown {
	if (isArray(value)) return [...value];

	return isObject(value) ? { ...value } : value;
}

export abstract class Tracker<
	Source extends Entity = Entity,
	Target extends Record<string, unknown> | unknown[] = Record<string, unknown> | unknown[],
>
	implements ReadonlyTracker, ProxyHandler<object>
{
	public readonly entity: Source;
	public readonly target: Target;
	public readonly trackers: Map<Entity, Tracker>;
	public readonly proxy: object;
	public filled = false;
	public written = false;
	public modified = false;
	private parent: Tracker | undefined;
	private track: Track;
	private children: Tracker[] | undefined;

	constructor(
		entity: Source,
		target: Target,
		parent: Tracker | undefined,
		trackers: Map<Entity, Tracker>,
		track: Track,
	) {
		this.entity = entity;
		this.target = target;
		this.parent = parent;
		this.trackers = trackers;
		this.track = track;
		this.proxy = new Proxy(target, this);

		trackers.set(entity, this);
	}

	public static of(value: unknown): Tracker | undefined {
		const tracker: unknown = isObject(value) ? Reflect.get(value, own) : undefined;

		return tracker instanceof Tracker ? tracker : undefined;
	}

	public get changed(): readonly Tracker[] {
		return this.children ?? none;
	}

	public get(_target: object, key: string | symbol, receiver: unknown): unknown {
		if (key === own) return this;

		const value: unknown = Reflect.get(this.real(), key, receiver);

		return this.pending(key, value) ? this.resolve(key, value) : value;
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
		this.seed();
	}

	protected abstract seed(): void;

	protected abstract pending(key: string | symbol, value: unknown): value is Entity;

	protected placeholder(entity: Entity): unknown {
		if (LWWRegister.is(entity)) return copy(entity.current);

		return this.trackers.get(entity)?.proxy ?? entity;
	}

	protected read(entity: Entity): unknown {
		return this.trackers.get(entity)?.proxy ?? this.track(entity, this);
	}

	private settle(key: string | symbol): void {
		const value: unknown = Reflect.get(this.target, key);

		if (this.pending(key, value)) this.resolve(key, value);
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
