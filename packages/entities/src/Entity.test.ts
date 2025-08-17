import { describe, expect, it, vi } from "vitest";
import { Entity } from "./Entity";

describe("Entity", () => {
	class TestEntity extends Entity {
		private _value: string;

		constructor(value: string) {
			super();
			this._value = value;
		}

		get value(): string {
			return this._value;
		}

		setValue(value: string): void {
			this._value = value;
			this.emit();
		}
	}

	it("should create an entity instance", () => {
		const entity = new TestEntity("initial");

		expect(entity).toBeInstanceOf(Entity);
		expect(entity.value).toBe("initial");
	});

	it("should subscribe to updates", () => {
		const entity = new TestEntity("initial");
		const callback = vi.fn();

		entity.subscribe(callback);

		entity.setValue("updated");

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith();
	});

	it("should support multiple subscribers", () => {
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

	it("should unsubscribe callback", () => {
		const entity = new TestEntity("initial");
		const callback = vi.fn();

		const unsubscribe = entity.subscribe(callback);

		entity.setValue("first update");

		expect(callback).toHaveBeenCalledTimes(1);

		unsubscribe();

		entity.setValue("second update");

		expect(callback).toHaveBeenCalledTimes(1);
	});
});
