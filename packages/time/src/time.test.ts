import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { TimestampMalformedError } from "./errors/timestamp-malformed-error";
import { Time } from "./time";

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

	it("provides an epoch", () => {
		const epoch = Time.epoch();

		expect(epoch.getTime()).toBe(0);
		expect(epoch.getCounter()).toBe(0);
		expect(epoch.toString()).toBe("1970-01-01T00:00:00.000Z+00000+00000000-0000-0000-0000-000000000000");
		expect(Time.epoch().compare(epoch)).toBe(0);

		expect(Time.now().isAfter(Time.epoch())).toBe(true);
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

	it.each([
		"1970-01-01T00:00:00.000Z+00001+replica+extra",
		"1970-01-01T00:00:00.000Z+00001+",
		"1970-01-01T00:00:00.000Z+0001+replica",
		"1970-01-01T00:00:00.000Z+100000+replica",
		"1970-01-01T00:00:00.000Z+0000g+replica",
		"1970-01-01T00:00:00.000Z+ggggg+replica",
		"not-a-date+00001+replica",
		"2024-01-01T12:00:00+00001+replica",
		"2024-01-01T12:00:00.000+00001+replica",
		"2024-01-01+00001+replica",
		"Jan 1 2024 12:00 GMT+00001+replica",
		"2024-01-01 12:00:00.000Z+00001+replica",
		"2024-01-01T12:00:00.000z+00001+replica",
	])("rejects malformed stored timestamp %s", (timestamp) => {
		expect(() => Time.fromTimestamp(timestamp)).toThrow(TimestampMalformedError);
	});

	it.each([
		["2024-11-10T13:39:10.776+01:00+00002+replica-id", Date.UTC(2024, 10, 10, 12, 39, 10, 776)],
		["2024-11-10T12:39:10Z+00002+replica-id", Date.UTC(2024, 10, 10, 12, 39, 10)],
		["2024-11-10T12:39Z+00002+replica-id", Date.UTC(2024, 10, 10, 12, 39)],
	])("parses timestamp %s with an explicit zone", (timestamp, time) => {
		expect(Time.fromTimestamp(timestamp).getTime()).toBe(time);
	});

	it.each([0, Date.UTC(2024, 10, 10, 12, 39, 10, 776), Date.UTC(10_000, 0, 1), Date.UTC(-1, 0, 1)])(
		"parses every timestamp it formats from time %i",
		(time) => {
			const timestamp = new Time(time, 2, "replica-id").toString();

			expect(Time.fromTimestamp(timestamp).getTime()).toBe(time);
		},
	);

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

	it("formats a time once", () => {
		const time = new Time(1731242350776, 2, "replica-id");
		const format = vi.spyOn(Date.prototype, "toISOString");

		expect(time.toString()).toBe("2024-11-10T12:39:10.776Z+00002+replica-id");
		expect(time.toString()).toBe("2024-11-10T12:39:10.776Z+00002+replica-id");
		expect(format).toHaveBeenCalledOnce();

		format.mockRestore();
	});

	it("reuses the timestamp it was parsed from", () => {
		const format = vi.spyOn(Date.prototype, "toISOString");

		expect(Time.fromTimestamp("2024-11-10T12:39:10.776Z+00002+replica-id").toString()).toBe(
			"2024-11-10T12:39:10.776Z+00002+replica-id",
		);
		expect(format).not.toHaveBeenCalled();

		format.mockRestore();
	});
});
