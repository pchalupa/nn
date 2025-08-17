import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LWWRegister } from "./LWWRegister";

describe("LWWRegister", () => {
	let currentTime: number;

	beforeEach(() => {
		currentTime = 1000000;
		vi.spyOn(Date, "now").mockImplementation(() => currentTime);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create a register with initial value", () => {
		const register = new LWWRegister("initial");

		expect(register.current).toBe("initial");
		expect(register).toBeInstanceOf(LWWRegister);
		expect(register.toString()).toBe("[object LWWRegister]");
	});

	it("should work with different types", () => {
		const stringRegister = new LWWRegister("string");
		const numberRegister = new LWWRegister(42);
		const objectRegister = new LWWRegister({ key: "value" });

		expect(stringRegister.current).toBe("string");
		expect(numberRegister.current).toBe(42);
		expect(objectRegister.current).toEqual({ key: "value" });
	});

	it("should update value", () => {
		const register = new LWWRegister("initial");

		register.current = "updated";

		expect(register.current).toBe("updated");
	});

	describe("merge", () => {
		it("should keep the value from the register with later timestamp", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);

			expect(registerA.current).toBe("bar");
			expect(registerB.current).toBe("bar");
		});

		it("should update remote register when local timestamp is later", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			currentTime = 2000000;
			registerA.current = "updated_foo";

			registerA.merge(registerB);

			expect(registerA.current).toBe("updated_foo");
			expect(registerB.current).toBe("updated_foo");
		});

		it("should update local register when remote timestamp is later", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;
			const registerB = new LWWRegister("bar");

			registerB.merge(registerA);

			expect(registerA.current).toBe("bar");
			expect(registerB.current).toBe("bar");
		});

		it("should work with multiple sequential merges", () => {
			const registerA = new LWWRegister("a");

			currentTime = 2000000;
			const registerB = new LWWRegister("b");

			currentTime = 3000000;
			const registerC = new LWWRegister("c");

			registerA.merge(registerB).merge(registerC);

			expect(registerA.current).toBe("c");
		});

		it("should preserve object references correctly", () => {
			const objA = { id: 1, name: "A" };
			const objB = { id: 2, name: "B" };

			const registerA = new LWWRegister(objA);

			currentTime = 2000000;

			const registerB = new LWWRegister(objB);

			registerA.merge(registerB);

			expect(registerA.current).toBe(objB);
		});

		it("should maintain consistency after bidirectional merge", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);
			registerB.merge(registerA);

			expect(registerA.current).toBe(registerB.current);
		});

		it("should handle concurrent updates correctly", async () => {
			const [registerA, registerB] = await Promise.all([
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("foo"))),
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("bar"))),
			]);

			registerA.merge(registerB);

			expect(registerA.current).toBe("bar");
		});
	});

	describe("subscribe", () => {
		it("should call callback when value is updated", () => {
			const register = new LWWRegister("initial");
			const callback = vi.fn();

			register.subscribe(callback);
			register.current = "updated";

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("should call callback when merged with newer remote", () => {
			const registerA = new LWWRegister("foo");
			const callback = vi.fn();

			registerA.subscribe(callback);

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("should return unsubscribe function", () => {
			const register = new LWWRegister("initial");
			const callback = vi.fn();

			const unsubscribe = register.subscribe(callback);

			unsubscribe();

			register.current = "updated";

			expect(callback).not.toHaveBeenCalled();
		});

		it("should handle multiple subscribers", () => {
			const register = new LWWRegister("initial");
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			register.subscribe(callback1);
			register.subscribe(callback2);

			register.current = "updated";

			expect(callback1).toHaveBeenCalledTimes(1);
			expect(callback2).toHaveBeenCalledTimes(1);
		});
	});
});
