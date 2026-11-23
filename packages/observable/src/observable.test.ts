import { describe, expect, it, vi } from "vitest";

import { Observable } from "./observable";

describe("Observable", () => {
	it("passes the notified arguments to every observer", () => {
		const subject = new Observable<[string, number]>();
		const first = vi.fn();
		const second = vi.fn();

		subject.subscribe(first);
		subject.subscribe(second);
		subject.notify("changed", 2);

		expect(first).toHaveBeenCalledExactlyOnceWith("changed", 2);
		expect(second).toHaveBeenCalledExactlyOnceWith("changed", 2);
	});

	it("stops notifying only the unsubscribed observer", () => {
		const subject = new Observable();
		const removed = vi.fn();
		const kept = vi.fn();

		const unsubscribe = subject.subscribe(removed);

		subject.subscribe(kept);
		unsubscribe();
		subject.notify();

		expect(removed).not.toHaveBeenCalled();
		expect(kept).toHaveBeenCalledOnce();
	});

	it("notifies an observer subscribed twice once", () => {
		const subject = new Observable();
		const observer = vi.fn();

		subject.subscribe(observer);
		subject.subscribe(observer);
		subject.notify();

		expect(observer).toHaveBeenCalledOnce();
	});

	it("notifies every observer when one unsubscribes during notification", () => {
		const subject = new Observable();
		const second = vi.fn();
		const unsubscribe = subject.subscribe(() => unsubscribe());

		subject.subscribe(second);
		subject.notify();

		expect(second).toHaveBeenCalledOnce();
	});

	it("notifies every observer when one throws, then rethrows the first error", () => {
		const subject = new Observable();
		const second = vi.fn();

		subject.subscribe(() => {
			throw new Error("first");
		});
		subject.subscribe(second);

		expect(() => subject.notify()).toThrow("first");
		expect(second).toHaveBeenCalledOnce();
	});
});
