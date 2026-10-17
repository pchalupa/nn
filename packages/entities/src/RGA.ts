import type { Unsubscribe } from "@nn/event-emitter/Observable";

import { Entity } from "./Entity";

// TODO!: Implementation of RGA isn't done yet. This is just temporary stub!
export class RGA<Value extends Entity> extends Entity<Value[]> {
	private items = new Map<string, Value>();
	private subscriptions = new Map<string, Unsubscribe>();

	constructor(items: Value[] = [], key?: string) {
		super(key);

		for (const item of items) this.insert(item);
	}

	private insert(item: Value): void {
		const existing = this.items.get(item.key);

		if (existing) existing.merge(item);
		else {
			this.items.set(item.key, item);
			this.observe(item);
		}
	}

	private observe(item: Value): void {
		this.unobserve(item.key);
		this.subscriptions.set(
			item.key,
			item.subscribe(() => this.emit("change")),
		);
	}

	private unobserve(key: string): void {
		this.subscriptions.get(key)?.();
		this.subscriptions.delete(key);
	}

	public get current(): Value[] {
		return Array.from(this.items.values());
	}

	public set current(items: Value[]) {
		for (const item of this.items.values()) this.unobserve(item.key);

		this.items.clear();

		for (const item of items) this.insert(item);

		this.emit("change");
	}

	public find(key: string): Value | undefined {
		return this.items.get(key);
	}

	public push(item: Value): void {
		this.insert(item);

		this.emit("change");
	}

	public remove(key: string): void {
		if (this.items.has(key)) {
			this.items.delete(key);
			this.unobserve(key);
			this.emit("change");
		}
	}

	public merge(other: RGA<Value>): this {
		const size = this.items.size;
		for (const item of other.current) this.insert(item);

		if (size !== this.items.size) this.emit("change");

		return this;
	}
}
