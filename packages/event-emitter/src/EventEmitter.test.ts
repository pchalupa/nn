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

	it("should remove a listener", () => {
		const eventEmitter = new EventEmitter<{ test: [string] }>();
		const listener = vi.fn();

		eventEmitter.on("test", listener);
		eventEmitter.off("test", listener);
		eventEmitter.emit("test", "hello");

		expect(listener).not.toHaveBeenCalled();
	});
});
