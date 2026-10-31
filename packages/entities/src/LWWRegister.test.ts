import { Time } from "@nn/time";
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

	it("creates a register with initial value", () => {
		const now = vi.spyOn(Time, "now");
		const register = new LWWRegister("initial");

		expect(register.current).toBe("initial");
		expect(register).toBeInstanceOf(LWWRegister);
		expect(register.toString()).toBe("[object LWWRegister]");
		expect(now).toHaveBeenCalledOnce();
	});

	it("works with different types", () => {
		const stringRegister = new LWWRegister("string");
		const numberRegister = new LWWRegister(42);
		const objectRegister = new LWWRegister({ key: "value" });

		expect(stringRegister.current).toBe("string");
		expect(numberRegister.current).toBe(42);
		expect(objectRegister.current).toStrictEqual({ key: "value" });
	});

	it("serializes register", () => {
		expect(JSON.stringify(new LWWRegister("string"))).toMatchInlineSnapshot(`""string""`);
		expect(JSON.stringify(new LWWRegister(42))).toMatchInlineSnapshot(`"42"`);
	});

	it("encodes its key, value and timestamp", () => {
		const timestamp = Time.epoch();

		expect(new LWWRegister("value", "title", timestamp).encode()).toStrictEqual({
			key: "title",
			data: "value",
			metadata: { kind: "LWWRegister", timestamp: timestamp.toString() },
		});
	});

	it("updates value", () => {
		const register = new LWWRegister("initial");

		register.current = "updated";

		expect(register.current).toBe("updated");
	});

	describe("initial defaults", () => {
		it("creates a default without minting a timestamp", () => {
			const now = vi.spyOn(Time, "now");
			const timestamp = Time.epoch();
			const register = new LWWRegister("default", "language", timestamp);

			expect(register.key).toBe("language");
			expect(register.timestamp).toBe(timestamp);
			expect(now).not.toHaveBeenCalled();
		});

		it("loses to any timestamped value", () => {
			const register = new LWWRegister("default", "language", Time.epoch());
			const remote = new LWWRegister("saved", "language", new Time(1, 0, "remote"));
			const listener = vi.fn();

			register.delegate = { entityDidChange: listener };

			register.merge(remote);

			expect(register.current).toBe("saved");
			expect(register.timestamp).toBe(remote.timestamp);
			expect(listener).toHaveBeenCalledExactlyOnceWith(register, undefined);
		});

		it("keeps a timestamped value when merging a default", () => {
			const register = new LWWRegister("written", "language");
			const remote = new LWWRegister("default", "language", Time.epoch());
			const listener = vi.fn();

			register.delegate = { entityDidChange: listener };

			register.merge(remote);

			expect(register.current).toBe("written");
			expect(remote.current).toBe("written");
			expect(listener).not.toHaveBeenCalled();
		});

		it("timestamps the first ordinary write", () => {
			const register = new LWWRegister("default", "language", Time.epoch());
			const now = vi.spyOn(Time, "now");

			register.current = "written";

			expect(register.timestamp.getTime()).toBe(currentTime);
			expect(now).toHaveBeenCalledOnce();
		});

		it("timestamps and notifies an assignment equal to the untouched default", () => {
			const register = new LWWRegister("default", "language", Time.epoch());
			const now = vi.spyOn(Time, "now");
			const listener = vi.fn();

			register.delegate = { entityDidChange: listener };

			register.current = "default";

			expect(register.current).toBe("default");
			expect(register.timestamp.isAfter(Time.epoch())).toBe(true);
			expect(now).toHaveBeenCalledOnce();
			expect(listener).toHaveBeenCalledOnce();
		});
	});

	it("keeps a supplied timestamp without minting a new one", () => {
		const timestamp = new Time(0, 5, "saved-replica");
		const now = vi.spyOn(Time, "now");
		const restored = new LWWRegister("Saved", "saved-key", timestamp);

		expect(restored.key).toBe("saved-key");
		expect(restored.timestamp.toString()).toBe("1970-01-01T00:00:00.000Z+00005+saved-replica");
		expect(now).not.toHaveBeenCalled();

		restored.current = "Changed";

		expect(restored.timestamp.isAfter(timestamp)).toBe(true);
	});

	describe("merge", () => {
		it("keeps the value from the register with later timestamp", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);

			expect(registerA.current).toBe("bar");
			expect(registerB.current).toBe("bar");
		});

		it("updates remote register when local timestamp is later", () => {
			const registerA = new LWWRegister("foo");
			const registerB = new LWWRegister("bar");

			currentTime = 2000000;
			registerA.current = "updated_foo";

			registerA.merge(registerB);

			expect(registerA.current).toBe("updated_foo");
			expect(registerB.current).toBe("updated_foo");
		});

		it("updates local register when remote timestamp is later", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;
			const registerB = new LWWRegister("bar");

			registerB.merge(registerA);

			expect(registerA.current).toBe("bar");
			expect(registerB.current).toBe("bar");
		});

		it("works with multiple sequential merges", () => {
			const registerA = new LWWRegister("a");

			currentTime = 2000000;
			const registerB = new LWWRegister("b");

			currentTime = 3000000;
			const registerC = new LWWRegister("c");

			registerA.merge(registerB).merge(registerC);

			expect(registerA.current).toBe("c");
		});

		it("preserves object references correctly", () => {
			const objA = { id: 1, name: "A" };
			const objB = { id: 2, name: "B" };

			const registerA = new LWWRegister(objA);

			currentTime = 2000000;

			const registerB = new LWWRegister(objB);

			registerA.merge(registerB);

			expect(registerA.current).toBe(objB);
		});

		it("maintains consistency after bidirectional merge", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);
			registerB.merge(registerA);

			expect(registerA.current).toBe(registerB.current);
		});

		it("handles concurrent updates correctly", async () => {
			const [registerA, registerB] = await Promise.all([
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("foo"))),
				new Promise<LWWRegister<string>>((resolve) => resolve(new LWWRegister("bar"))),
			]);

			registerA.merge(registerB);

			expect(registerA.current).toBe("bar");
		});
	});

	describe("delegate", () => {
		it("reports an assignment", () => {
			const register = new LWWRegister("initial");
			const delegate = { entityDidChange: vi.fn() };

			register.delegate = delegate;
			register.current = "updated";

			expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(register, undefined);
		});

		it("reports a merge the remote wins", () => {
			const registerA = new LWWRegister("foo");
			const delegate = { entityDidChange: vi.fn() };

			registerA.delegate = delegate;

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);

			expect(delegate.entityDidChange).toHaveBeenCalledExactlyOnceWith(registerA, undefined);
		});
	});
});
