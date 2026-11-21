import { InvalidatableCache } from "@nn/cache/invalidatable-cache";
import { isArray } from "@nn/guards/is-array";
import { isString } from "@nn/guards/is-string";

import type { Decoder, Encoded } from "./codable";
import { Entity, type EntityDelegate } from "./entity";

// TODO!: Ordering is not converged yet; only removals are tombstoned.
/**
 * Replicated list of child entities. Removed keys are tombstoned, so a removal wins and the key can't come back.
 * Ordering doesn't converge yet.
 *
 * @example
 * const tags = new RGA([new LWWRegister("urgent")]);
 *
 * tags.push(new LWWRegister("backend"));
 * tags.remove(tags.current[0].key);
 */
export class RGA<Value extends Entity> extends Entity<Value[]> implements EntityDelegate {
	private items = new Map<string, Value>();
	private cachedItems = new InvalidatableCache<Value[]>();
	private tombstoned: Set<string>;

	constructor(items: Value[] = [], key?: string, tombstones: Iterable<string> = []) {
		super("RGA", key);

		this.tombstoned = new Set(tombstones);

		for (const item of items) this.insert(item);
	}

	private insert(item: Value): void {
		if (!this.tombstoned.has(item.key)) {
			const existing = this.items.get(item.key);

			if (existing) existing.merge(item);
			else {
				this.items.set(item.key, item);
				this.cachedItems.invalidate();
				item.delegate = this;
			}
		}
	}

	private detach(key: string): void {
		const item = this.items.get(key);

		if (item) {
			this.items.delete(key);
			this.cachedItems.invalidate();
			item.delegate = undefined;
		}
	}

	public entityDidChange(child: Entity): void {
		this.didChange(child);
	}

	public get current(): Value[] {
		return this.cachedItems.ensure(() => Array.from(this.items.values()));
	}

	public set current(items: Value[]) {
		const previous = this.items;

		this.items = new Map();
		this.cachedItems.invalidate();

		for (const item of items) this.insert(item);

		for (const [key, item] of previous) {
			const next = this.items.get(key);

			if (next !== item) item.delegate = undefined;

			if (!next) this.tombstoned.add(key);
		}

		this.didChange();
	}

	public get size(): number {
		return this.items.size;
	}

	/** Keys of removed items. */
	public get tombstones(): ReadonlySet<string> {
		return this.tombstoned;
	}

	public [Symbol.iterator](): IterableIterator<Value> {
		return this.current.values();
	}

	public keys(): MapIterator<string> {
		return this.items.keys();
	}

	/** Returns the item with `key`, or `undefined` when it's missing or removed */
	public get(key: string): Value | undefined {
		return this.items.get(key);
	}

	public push(item: Value): void {
		const size = this.items.size;

		this.insert(item);

		if (this.items.size !== size) this.didChange();
	}

	/** Removes the item and tombstones its key, so no replica can add it back */
	public remove(key: string): void {
		if (this.items.has(key)) {
			this.detach(key);
			this.tombstoned.add(key);
			this.didChange();
		}
	}

	public merge(other: RGA<Value>): this {
		const removed = other.tombstoned.difference(this.tombstoned);

		for (const key of removed) {
			this.detach(key);
			this.tombstoned.add(key);
		}

		const size = this.items.size;

		for (const item of other.current) this.insert(item);

		if (removed.size > 0 || this.items.size !== size) this.didChange();

		return this;
	}

	public encode(): Encoded<Encoded[], { kind: string; tombstones: string[] }> {
		const data: Encoded[] = [];
		const tombstones = Array.from(this.tombstoned);

		for (const item of this.items.values()) {
			data.push(item.encode());
		}

		return { key: this.key, data, metadata: { kind: this.kind, tombstones } };
	}

	public static decode(encoded: Encoded, decoder: Decoder): RGA<Entity> {
		RGA.assertEncoded(encoded);

		const items: Entity[] = [];

		for (const item of encoded.data) {
			items.push(decoder.decode(item));
		}

		return new RGA(items, encoded.key, encoded.metadata.tombstones);
	}

	public static override is(entity: unknown): entity is RGA<Entity> {
		return entity instanceof RGA;
	}

	public static override assert(entity: unknown): asserts entity is RGA<Entity> {
		if (!RGA.is(entity)) throw new TypeError("Invalid RGA.");
	}

	private static assertEncoded(
		encoded: Encoded,
	): asserts encoded is Encoded<readonly unknown[], { kind: string; tombstones: readonly string[] }> {
		const { data, metadata } = encoded;
		const tombstones = "tombstones" in metadata ? metadata.tombstones : undefined;

		if (!isArray(data) || !isArray(tombstones) || !tombstones.every(isString)) {
			throw new TypeError("Invalid encoded RGA.");
		}
	}
}
