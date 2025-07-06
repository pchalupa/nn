import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Time } from "./Time";

describe("Time", () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	it("should update physical time", async () => {
		const firstEvent = Time.now();
		await vi.advanceTimersByTimeAsync(100);
		const secondEvent = Time.now();

		expect(secondEvent.getTime()).toBeGreaterThan(firstEvent.getTime());
		expect(secondEvent.getCounter()).toBeGreaterThanOrEqual(firstEvent.getCounter());
	});

	it("should update counter for concurrent events", async () => {
		const [firstEvent, secondEvent] = await Promise.all([Time.now(), Time.now()]);

		expect(secondEvent.getTime()).toBe(firstEvent.getTime());
		expect(secondEvent.getCounter()).toBeGreaterThan(firstEvent.getCounter());
	});

	it.concurrent("should convert time to timestamp", () => {
		expect(new Time(0, 0).toString()).toBe("1970-01-01T00:00:00.000Z+00000");
		expect(new Time(1731242350776, 2).toString()).toBe("2024-11-10T12:39:10.776Z+00002");
	});

	it("should parse time from timestamp", () => {
		expect(Time.fromTimestamp("1970-01-01T00:00:00.000Z+00000").getTime()).toBe(0);
		expect(Time.fromTimestamp("1970-01-01T00:00:00.000Z+00000").getCounter()).toBe(0);
		expect(Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002").getTime()).toBe(1731242350776);
		expect(Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002").getCounter()).toBe(2);
		expect(Time.fromTimestamp("").getTime()).toBe(0);
		expect(Time.fromTimestamp("").getCounter()).toBe(0);
	});

	it("should return true if time is after another time", () => {
		expect(new Time(1, 0).isAfter(new Time(0, 0))).toBe(true);
		expect(new Time(1, 0).isAfter(new Time(0, 1))).toBe(true);
		expect(new Time(0, 2).isAfter(new Time(0, 1))).toBe(true);
	});

	it("should return false if time is not after another time", () => {
		expect(new Time(0, 0).isAfter(new Time(0, 0))).toBe(false);
		expect(new Time(0, 0).isAfter(new Time(1, 0))).toBe(false);
		expect(new Time(0, 1).isAfter(new Time(0, 2))).toBe(false);
	});
});
