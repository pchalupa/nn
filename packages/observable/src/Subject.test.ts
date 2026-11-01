import { describe, expect, it, vi } from "vitest";

import { Subject } from "./Subject";

describe("Subject", () => {
	it("notifies every observer", () => {
		const subject = new Subject();
		const first = vi.fn();
		const second = vi.fn();

		subject.subscribe(first);
		subject.subscribe(second);
		subject.notify();

		expect(first).toHaveBeenCalledOnce();
		expect(second).toHaveBeenCalledOnce();
	});

	it("stops notifying an observer after it unsubscribes", () => {
		const subject = new Subject();
		const observer = vi.fn();

		subject.subscribe(observer)();
		subject.notify();

		expect(observer).not.toHaveBeenCalled();
	});

	it("stops notifying only the unsubscribed observer", () => {
		const subject = new Subject();
		const removed = vi.fn();
		const kept = vi.fn();

		subject.subscribe(removed);
		subject.subscribe(kept);
		subject.unsubscribe(removed);
		subject.notify();

		expect(removed).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledOnce();
	});

	it("ignores unsubscribing an observer that never subscribed", () => {
		const subject = new Subject();
		const observer = vi.fn();

		subject.subscribe(observer);
		subject.unsubscribe(vi.fn());
		subject.notify();

		expect(observer).toHaveBeenCalledOnce();
	});

	it("notifies an observer subscribed twice once", () => {
		const subject = new Subject();
		const observer = vi.fn();

		subject.subscribe(observer);
		subject.subscribe(observer);
		subject.notify();

		expect(observer).toHaveBeenCalledOnce();
	});

	it("notifies every observer when one unsubscribes during notification", () => {
		const subject = new Subject();
		const second = vi.fn();
		const unsubscribe = subject.subscribe(() => unsubscribe());

		subject.subscribe(second);
		subject.notify();

		expect(second).toHaveBeenCalledOnce();
	});
});
