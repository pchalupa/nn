import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { TimestampMalformedError } from "./errors/TimestampMalformedError";
import { Time } from "./Time";

describe("Time", () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	it("updates physical time", async () => {
		const firstEvent = Time.now();
		await vi.advanceTimersByTimeAsync(100);
		const secondEvent = Time.now();

		expect(secondEvent.getTime()).toBeGreaterThan(firstEvent.getTime());
		expect(secondEvent.getCounter()).toBeGreaterThanOrEqual(firstEvent.getCounter());
	});

	it("updates counter for concurrent events", async () => {
		const [firstEvent, secondEvent] = await Promise.all([Time.now(), Time.now()]);

		expect(secondEvent.getTime()).toBe(firstEvent.getTime());
		expect(secondEvent.getCounter()).toBeGreaterThan(firstEvent.getCounter());
	});

	it.concurrent("converts time to timestamp", () => {
		const replicaId = "replica-id";

		expect(new Time(0, 0, replicaId).toString()).toBe(`1970-01-01T00:00:00.000Z+00000+${replicaId}`);
		expect(new Time(1731242350776, 2, replicaId).toString()).toBe(`2024-11-10T12:39:10.776Z+00002+${replicaId}`);
	});

	it("parses time from timestamp", () => {
		expect(Time.fromTimestamp("1970-01-01T00:00:00.000Z+00000+replica-id").getTime()).toBe(0);
		expect(Time.fromTimestamp("1970-01-01T00:00:00.000Z+00000+replica-id").getCounter()).toBe(0);
		expect(Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002+replica-id").getTime()).toBe(1731242350776);
		expect(Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002+replica-id").getCounter()).toBe(2);
	});

	it("throws an malformed error when parsing invalid timestamp", () => {
		expect(() => Time.fromTimestamp("")).toThrow(TimestampMalformedError);
		expect(() => Time.fromTimestamp("1970-01-01T00:00:00.000Z")).toThrow(TimestampMalformedError);
		expect(() => Time.fromTimestamp("1970-01-01T00:00:00.000Z+00000")).toThrow(TimestampMalformedError);
	});

	it("compares by physical time, then counter, then replica id", () => {
		expect(new Time(1, 0, "b").compare(new Time(0, 5, "a"))).toBeGreaterThan(0);
		expect(new Time(0, 5, "a").compare(new Time(1, 0, "b"))).toBeLessThan(0);

		expect(new Time(0, 2, "a").compare(new Time(0, 1, "b"))).toBeGreaterThan(0);
		expect(new Time(0, 1, "b").compare(new Time(0, 2, "a"))).toBeLessThan(0);

		expect(new Time(0, 0, "b").compare(new Time(0, 0, "a"))).toBe(1);
		expect(new Time(0, 0, "a").compare(new Time(0, 0, "b"))).toBe(-1);

		expect(new Time(0, 0, "a").compare(new Time(0, 0, "a"))).toBe(0);
	});

	it("returns true if time is after another time", () => {
		expect(new Time(1, 0).isAfter(new Time(0, 0))).toBe(true);
		expect(new Time(1, 0).isAfter(new Time(0, 1))).toBe(true);
		expect(new Time(0, 2).isAfter(new Time(0, 1))).toBe(true);
	});

	it("returns false if time is not after another time", () => {
		expect(new Time(0, 0).isAfter(new Time(0, 0))).toBe(false);
		expect(new Time(0, 0).isAfter(new Time(1, 0))).toBe(false);
		expect(new Time(0, 1).isAfter(new Time(0, 2))).toBe(false);
	});
});
