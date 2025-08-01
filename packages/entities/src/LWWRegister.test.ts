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

		expect(register.value).toBe("initial");
	});

	it("should work with different types", () => {
		const stringRegister = new LWWRegister("string");
		const numberRegister = new LWWRegister(42);
		const objectRegister = new LWWRegister({ key: "value" });

		expect(stringRegister.value).toBe("string");
		expect(numberRegister.value).toBe(42);
		expect(objectRegister.value).toEqual({ key: "value" });
	});

	it("should update value", () => {
		const register = new LWWRegister("initial");

		register.value = "updated";

		expect(register.value).toBe("updated");
	});

	describe("merge", () => {
		it("should keep the value from the register with later timestamp", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);

			expect(registerA.value).toBe("bar");
			expect(registerB.value).toBe("bar");
		});

		it("should update remote register when local timestamp is later", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			currentTime = 2000000;
			registerA.value = "updated_foo";

			registerA.merge(registerB);

			expect(registerA.value).toBe("updated_foo");
			expect(registerB.value).toBe("updated_foo");
		});

		it("should update local register when remote timestamp is later", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;
			const registerB = new LWWRegister("bar");

			registerB.merge(registerA);

			expect(registerA.value).toBe("bar");
			expect(registerB.value).toBe("bar");
		});

		it("should work with multiple sequential merges", () => {
			const registerA = new LWWRegister("a");

			currentTime = 2000000;
			const registerB = new LWWRegister("b");

			currentTime = 3000000;
			const registerC = new LWWRegister("c");

			registerA.merge(registerB).merge(registerC);

			expect(registerA.value).toBe("c");
		});

		it("should preserve object references correctly", () => {
			const objA = { id: 1, name: "A" };
			const objB = { id: 2, name: "B" };

			const registerA = new LWWRegister(objA);

			currentTime = 2000000;

			const registerB = new LWWRegister(objB);

			registerA.merge(registerB);

			expect(registerA.value).toBe(objB);
		});

		it("should maintain consistency after bidirectional merge", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);
			registerB.merge(registerA);

			expect(registerA.value).toBe(registerB.value);
		});

		it("should handle concurrent updates correctly", async () => {
			const [registerA, registerB] = await Promise.all([
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("foo"))),
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("bar"))),
			]);

			registerA.merge(registerB);

			expect(registerA.value).toBe("bar");
		});
	});
});
