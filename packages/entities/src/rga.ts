import { isArray } from "@nn/guards/is-array";
import { isString } from "@nn/guards/is-string";

import type { Decoder, Encoded } from "./codable";
import { Entity, type EntityDelegate } from "./entity";

// TODO!: Ordering is not converged yet; only removals are tombstoned.
export class RGA<Value extends Entity> extends Entity<Value[]> implements EntityDelegate {
	private items = new Map<string, Value>();
	private tombstones: Set<string>;

	constructor(items: Value[] = [], key?: string, tombstones: Iterable<string> = []) {
		super("RGA", key);

		this.tombstones = new Set(tombstones);

		for (const item of items) this.insert(item);
	}

	private insert(item: Value): void {
		if (!this.tombstones.has(item.key)) {
			const existing = this.items.get(item.key);

			if (existing) existing.merge(item);
			else {
				this.items.set(item.key, item);
				item.delegate = this;
			}
		}
	}

	private detach(key: string): void {
		const item = this.items.get(key);

		if (item) {
			this.items.delete(key);
			item.delegate = undefined;
		}
	}

	public entityDidChange(child: Entity): void {
		this.didChange(child);
	}

	public get current(): Value[] {
		return Array.from(this.items.values());
	}

	public set current(items: Value[]) {
		const kept = new Set<string>();

		for (const item of items) kept.add(item.key);

		for (const [key, item] of this.items) {
			item.delegate = undefined;

			if (!kept.has(key)) this.tombstones.add(key);
		}

		this.items.clear();

		for (const item of items) this.insert(item);

		this.didChange();
	}

	public map<Next extends Entity>(callback: (item: Value) => Next): RGA<Next> {
		const items: Next[] = [];

		for (const item of this.items.values()) items.push(callback(item));

		return new RGA(items, this.key, this.tombstones);
	}

	public find(key: string): Value | undefined {
		return this.items.get(key);
	}

	public push(item: Value): void {
		const size = this.items.size;

		this.insert(item);

		if (this.items.size !== size) this.didChange();
	}

	public remove(key: string): void {
		if (this.items.has(key)) {
			this.detach(key);
			this.tombstones.add(key);
			this.didChange();
		}
	}

	public merge(other: RGA<Value>): this {
		const removed = other.tombstones.difference(this.tombstones);

		for (const key of removed) this.detach(key);

		this.tombstones = this.tombstones.union(removed);

		const size = this.items.size;

		for (const item of other.current) this.insert(item);

		if (removed.size > 0 || this.items.size !== size) this.didChange();

		return this;
	}

	public encode(): Encoded<Encoded[], { kind: string; tombstones: string[] }> {
		const data: Encoded[] = [];

		for (const item of this.items.values()) {
			data.push(item.encode());
		}

		return { key: this.key, data, metadata: { kind: this.kind, tombstones: Array.from(this.tombstones) } };
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
