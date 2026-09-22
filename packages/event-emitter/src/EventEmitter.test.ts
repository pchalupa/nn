import { describe, expect, it, vi } from "vitest";

import { EventEmitter } from "./EventEmitter";

describe("EventEmitter", () => {
	it("should create an instance of event emitter", () => {
		const eventEmitter = new EventEmitter<{ test: [string] }>();

		expect(eventEmitter).toBeInstanceOf(EventEmitter);
		expect(eventEmitter).toHaveProperty("events");
	});

	it("should emit an event", () => {
		const eventEmitter = new EventEmitter<{ test: [string] }>();
		const listener = vi.fn();

		eventEmitter.on("test", listener);
		eventEmitter.emit("test", "hello");

		expect(listener).toHaveBeenCalledWith("hello");
	});

	it("should emit an event once", () => {
		const eventEmitter = new EventEmitter<{ test: [string] }>();
		const listener = vi.fn();

		eventEmitter.once("test", listener);
		eventEmitter.emit("test", "hello");
		eventEmitter.emit("test", "hello");

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("should remove a once listener before invoking it", () => {
		const eventEmitter = new EventEmitter<{ test: [] }>();
		const listener = vi.fn(() => eventEmitter.emit("test"));

		eventEmitter.once("test", listener);
		eventEmitter.emit("test");

		expect(listener).toHaveBeenCalledOnce();
	});

	it("should remove a once listener when it throws", () => {
		const eventEmitter = new EventEmitter<{ test: [] }>();
		const listener = vi.fn(() => {
			throw new Error("test error");
		});

		eventEmitter.once("test", listener);

		expect(() => eventEmitter.emit("test")).toThrow("test error");
		expect(() => eventEmitter.emit("test")).not.toThrow();
		expect(listener).toHaveBeenCalledOnce();
	});

	it("should remove a listener", () => {
		const eventEmitter = new EventEmitter<{ test: [string] }>();
		const listener = vi.fn();

		eventEmitter.on("test", listener);
		eventEmitter.off("test", listener);
		eventEmitter.emit("test", "hello");

		expect(listener).not.toHaveBeenCalled();
	});
});
