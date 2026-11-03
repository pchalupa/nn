import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { type Encoded, Entity, type InferValueType } from "./Entity";
import type { LWWRegister } from "./LWWRegister";

describe("Entity", () => {
	afterEach(() => vi.restoreAllMocks());

	class TestEntity extends Entity<string> {
		constructor(
			private value: string,
			key?: string,
		) {
			super("test", key);
		}

		public get current(): string {
			return this.value;
		}

		public set current(value: string) {
			this.value = value;
			this.didChange();
		}

		public setValue(value: string): void {
			this.value = value;
			this.didChange();
		}

		public merge(): this {
			return this;
		}

		public encode(): Encoded<string> {
			return { key: this.key, data: this.value, metadata: { kind: this.kind } };
		}
	}

	it("creates an entity instance", () => {
		const entity = new TestEntity("initial");

		expect(entity).toBeInstanceOf(Entity);
		expect(entity.current).toBe("initial");
	});

	it("exposes the kind passed by its subclass", () => {
		expect(new TestEntity("initial").kind).toBe("test");
	});

	it("reports a change to its delegate", () => {
		const entity = new TestEntity("initial");
		const delegate = { entityDidChange: vi.fn() };

		entity.delegate = delegate;
		entity.setValue("updated");

		expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(entity, undefined);
		expect(entity.revision).toBe(1);
	});

	it("replaces the previous delegate", () => {
		const entity = new TestEntity("initial");
		const first = { entityDidChange: vi.fn() };
		const second = { entityDidChange: vi.fn() };

		entity.delegate = first;
		entity.delegate = second;
		entity.setValue("updated");

		expect(first.entityDidChange).not.toHaveBeenCalled();
		expect(second.entityDidChange).toHaveBeenCalledOnce();
	});

	it("stops reporting once detached", () => {
		const entity = new TestEntity("initial");
		const delegate = { entityDidChange: vi.fn() };

		entity.delegate = delegate;
		entity.delegate = undefined;
		entity.setValue("updated");

		expect(delegate.entityDidChange).not.toHaveBeenCalled();
		expect(entity.revision).toBe(1);
	});

	it("bumps the revision without a delegate", () => {
		const entity = new TestEntity("initial");

		entity.setValue("updated");

		expect(entity.revision).toBe(1);
	});

	it("writes the value through set", () => {
		const entity = new TestEntity("initial");
		const delegate = { entityDidChange: vi.fn() };

		entity.delegate = delegate;

		entity.set((current) => `${current} updated`);

		expect(entity.current).toBe("initial updated");
		expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(entity, undefined);
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

	it("guards any entity type", () => {
		expect(Entity.is(new TestEntity("value"))).toBeTruthy();
		expect(Entity.is({ key: "key", current: "value" })).toBeFalsy();
		expect(Entity.is(undefined)).toBeFalsy();
		expect(Entity.is(null)).toBeFalsy();
	});

	it("asserts any entity type", () => {
		expect(() => Entity.assert(new TestEntity("value"))).not.toThrow();
		expect(() => Entity.assert({ key: "key", current: "value" })).toThrow(new TypeError("Invalid entity."));
		expect(() => Entity.assert(undefined)).toThrow(TypeError);
		expect(() => Entity.assert(null)).toThrow(TypeError);
	});

	it("infers entity values", () => {
		expectTypeOf<InferValueType<Entity<{ title: LWWRegister<string> }>>>().toEqualTypeOf<{ title: string }>();
		expectTypeOf<InferValueType<Entity<string>>>().toEqualTypeOf<string>();
		expectTypeOf<InferValueType<Entity>>().toBeUnknown();
		expectTypeOf<InferValueType<string>>().toEqualTypeOf<string>();
	});
});
