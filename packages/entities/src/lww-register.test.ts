import { Time } from "@goodstate/time";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Codec } from "./codec";
import { LWWMap } from "./lww-map";
import { LWWRegister } from "./lww-register";

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

	it("guards a register", () => {
		expect(LWWRegister.is(new LWWRegister("value"))).toBeTruthy();
		expect(LWWRegister.is(new LWWMap({}))).toBeFalsy();
		expect(LWWRegister.is({ key: "key", current: "value" })).toBeFalsy();
		expect(LWWRegister.is(undefined)).toBeFalsy();
		expect(LWWRegister.is(null)).toBeFalsy();
	});

	it("asserts a register", () => {
		expect(() => LWWRegister.assert(new LWWRegister("value"))).not.toThrow();
		expect(() => LWWRegister.assert(new LWWMap({}))).toThrow(new TypeError("Invalid LWWRegister."));
		expect(() => LWWRegister.assert({ key: "key", current: "value" })).toThrow(TypeError);
		expect(() => LWWRegister.assert(undefined)).toThrow(TypeError);
		expect(() => LWWRegister.assert(null)).toThrow(TypeError);
	});

	it("encodes its key, value and timestamp", () => {
		const timestamp = Time.epoch();

		expect(new LWWRegister("value", "title", timestamp).encode()).toStrictEqual({
			key: "title",
			data: "value",
			metadata: { kind: "LWWRegister", timestamp: timestamp.toString() },
		});
	});

	describe("initial defaults", () => {
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

		it("maintains consistency after bidirectional merge", () => {
			const registerA = new LWWRegister("foo");

			currentTime = 2000000;

			const registerB = new LWWRegister("bar");

			registerA.merge(registerB);
			registerB.merge(registerA);

			expect(registerA.current).toBe(registerB.current);
		});
	});

	it("writes after a decoded register stamped ahead of the local clock", () => {
		const remote = new LWWRegister<unknown>("cs", "language", new Time(Time.now().getTime() + 60_000, 3, "remote"));
		const decoded = LWWRegister.decode(remote.encode());

		decoded.current = "en";

		expect(decoded.timestamp.isAfter(remote.timestamp)).toBe(true);
		remote.merge(decoded);
		expect(remote.current).toBe("en");
	});

	it("advances the clock for a register decoded inside a map", () => {
		const ahead = new Time(Time.now().getTime() + 60_000, 3, "remote");
		const map = new LWWMap({ language: new LWWRegister("cs", "language", ahead) }, "settings");

		new Codec().decode(map.encode());

		expect(Time.now().isAfter(ahead)).toBe(true);
	});

	it("leaves the clock alone when a timestamp is malformed", () => {
		const malformed = { key: "language", data: "cs", metadata: { kind: "LWWRegister", timestamp: "not-a-time" } };
		const before = Time.now();

		expect(() => LWWRegister.decode(malformed)).toThrow(/malformed/);

		const after = Time.now();

		expect(after.getTime()).toBe(before.getTime());
		expect(after.getCounter()).toBe(before.getCounter() + 1);
	});
});
