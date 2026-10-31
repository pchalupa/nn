import type { Decoder, Encoded } from "./Codable";
import { Entity, type EntityDelegate } from "./Entity";

// TODO!: Implementation of RGA isn't done yet. This is just temporary stub!
export class RGA<Value extends Entity> extends Entity<Value[]> implements EntityDelegate {
	private items = new Map<string, Value>();

	constructor(items: Value[] = [], key?: string) {
		super(key);

		for (const item of items) this.insert(item);
	}

	private insert(item: Value): void {
		const existing = this.items.get(item.key);

		if (existing) existing.merge(item);
		else {
			this.items.set(item.key, item);
			item.delegate = this;
		}
	}

	public entityDidChange(child: Entity): void {
		this.didChange(child);
	}

	public get current(): Value[] {
		return Array.from(this.items.values());
	}

	public set current(items: Value[]) {
		for (const item of this.items.values()) item.delegate = undefined;

		this.items.clear();

		for (const item of items) this.insert(item);

		this.didChange();
	}

	public find(key: string): Value | undefined {
		return this.items.get(key);
	}

	public push(item: Value): void {
		this.insert(item);

		this.didChange();
	}

	public remove(key: string): void {
		const item = this.items.get(key);

		if (item) {
			this.items.delete(key);
			item.delegate = undefined;
			this.didChange();
		}
	}

	public merge(other: RGA<Value>): this {
		const size = this.items.size;

		for (const item of other.current) this.insert(item);

		if (size !== this.items.size) this.didChange();

		return this;
	}

	public static decode(encoded: Encoded<Encoded[]>, decoder: Decoder): RGA<Entity> {
		const items: Entity[] = [];

		for (const item of encoded.data) {
			items.push(decoder.decode(item));
		}

		return new RGA(items, encoded.key);
	}

	public encode(): Encoded<Encoded[], { kind: string }> {
		const data: Encoded[] = [];

		for (const item of this.items.values()) {
			data.push(item.encode());
		}

		return { key: this.key, data, metadata: { kind: this.constructor.name } };
	}
}
