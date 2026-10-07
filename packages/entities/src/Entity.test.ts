import { afterEach, describe, expect, it, vi } from "vitest";

import { Entity } from "./Entity";

describe("Entity", () => {
	afterEach(() => vi.restoreAllMocks());

	class TestEntity extends Entity<string> {
		constructor(
			private value: string,
			key?: string,
		) {
			super(key);
		}

		public get current(): string {
			return this.value;
		}

		public set current(value: string) {
			this.value = value;
			this.emit("change");
		}

		public setValue(value: string): void {
			this.value = value;
			this.emit("change");
		}

		public merge(): this {
			return this;
		}
	}

	it("creates an entity instance", () => {
		const entity = new TestEntity("initial");

		expect(entity).toBeInstanceOf(Entity);
		expect(entity.current).toBe("initial");
	});

	it("subscribes to updates", () => {
		const entity = new TestEntity("initial");
		const callback = vi.fn();

		entity.subscribe(callback);

		entity.setValue("updated");

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith();
	});

	it("supports multiple subscribers", () => {
		const entity = new TestEntity("initial");
		const callback1 = vi.fn();
		const callback2 = vi.fn();
		const callback3 = vi.fn();

		entity.subscribe(callback1);
		entity.subscribe(callback2);
		entity.subscribe(callback3);

		entity.setValue("updated");

		expect(callback1).toHaveBeenCalledTimes(1);
		expect(callback2).toHaveBeenCalledTimes(1);
		expect(callback3).toHaveBeenCalledTimes(1);
	});

	it("unsubscribes callback", () => {
		const entity = new TestEntity("initial");
		const callback = vi.fn();

		const unsubscribe = entity.subscribe(callback);

		entity.setValue("first update");

		expect(callback).toHaveBeenCalledTimes(1);

		unsubscribe();

		entity.setValue("second update");

		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("writes the value through set", () => {
		const entity = new TestEntity("initial");
		const callback = vi.fn();

		entity.subscribe(callback);

		entity.set((current) => `${current} updated`);

		expect(entity.current).toBe("initial updated");
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it("serializes entity", () => {
		const entity = new TestEntity("initial");

		expect(JSON.stringify(entity)).toMatchInlineSnapshot(`""initial""`);
	});

	it("counts changes", () => {
		const entity = new TestEntity("initial");

		expect(entity.revision).toBe(0);

		entity.setValue("updated");
		entity.setValue("updated again");

		expect(entity.revision).toBe(2);
	});

	it("advances its revision through every write path", () => {
		const entity = new TestEntity("initial");
		const before = entity.revision;

		entity.set((current) => `${current} updated`);
		entity.current = "assigned";

		expect(entity.revision).toBe(before + 2);
	});
});
