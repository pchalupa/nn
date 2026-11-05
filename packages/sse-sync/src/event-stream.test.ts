import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventStream, type EventStreamDelegate } from "./event-stream";

let sources: FakeEventSource[] = [];

class FakeEventSource {
	public static readonly CLOSED = 2;
	public readyState = 1;
	public onmessage: ((event: MessageEvent) => void) | null = null;
	public onerror: (() => void) | null = null;
	public closed = false;
	public readonly url: string;

	constructor(url: string | URL) {
		this.url = String(url);
		sources.push(this);
	}

	public close(): void {
		this.closed = true;
		this.readyState = FakeEventSource.CLOSED;
	}

	public emit(data: unknown): void {
		this.onmessage?.(new MessageEvent("message", { data }));
	}

	public fail(): void {
		this.onerror?.();
	}

	public shutDown(): void {
		this.readyState = FakeEventSource.CLOSED;
		this.onerror?.();
	}
}

const url = new URL("http://remote.test/subscribe");

const delegateMock = () => ({
	eventStreamDidReceive: vi.fn<EventStreamDelegate["eventStreamDidReceive"]>(),
	eventStreamDidFail: vi.fn<EventStreamDelegate["eventStreamDidFail"]>(),
	eventStreamDidClose: vi.fn<EventStreamDelegate["eventStreamDidClose"]>(),
});

const open = async () => {
	const stream = new EventStream(url);
	const delegate = delegateMock();

	stream.delegate = delegate;

	const opening = stream.open(new AbortController().signal);

	sources[0]?.emit("snapshot");
	await opening;

	return { stream, delegate };
};

describe("EventStream", () => {
	beforeEach(() => {
		sources = [];
		vi.stubGlobal("EventSource", FakeEventSource);
	});

	afterEach(() => vi.unstubAllGlobals());

	it("subscribes to the given URL", () => {
		void new EventStream(url).open(new AbortController().signal);

		expect(sources[0]?.url).toBe("http://remote.test/subscribe");
	});

	it("opens once the first event is delivered to its delegate", async () => {
		const { delegate } = await open();

		expect(delegate.eventStreamDidReceive).toHaveBeenCalledExactlyOnceWith("snapshot");
	});

	it("delivers each later event to its delegate", async () => {
		const { delegate } = await open();

		sources[0]?.emit("update");

		expect(delegate.eventStreamDidReceive).toHaveBeenLastCalledWith("update");
	});

	it("keeps waiting for the first event while the browser retries", async () => {
		const stream = new EventStream(url);
		const opened = vi.fn();

		void stream.open(new AbortController().signal).then(opened);
		sources[0]?.fail();
		await Promise.resolve();

		expect(opened).not.toHaveBeenCalled();

		sources[0]?.emit("snapshot");

		await vi.waitFor(() => {
			expect(opened).toHaveBeenCalledOnce();
		});
	});

	it("fails to open when the browser closes the stream before the first event", async () => {
		const opening = new EventStream(url).open(new AbortController().signal);

		sources[0]?.shutDown();

		await expect(opening).rejects.toThrow("Failed to subscribe to http://remote.test/subscribe");
	});

	it("fails to open when the delegate cannot receive the first event", async () => {
		const stream = new EventStream(url);
		const error = new Error("invalid");

		stream.delegate = {
			...delegateMock(),
			eventStreamDidReceive: () => {
				throw error;
			},
		};

		const opening = stream.open(new AbortController().signal);

		sources[0]?.emit("snapshot");

		await expect(opening).rejects.toBe(error);
	});

	it("fails to open when aborted", async () => {
		const controller = new AbortController();
		const opening = new EventStream(url).open(controller.signal);

		controller.abort();

		await expect(opening).rejects.toMatchObject({ name: "AbortError" });
	});

	it("reports a later event it cannot deliver and keeps listening", async () => {
		const { delegate } = await open();
		const error = new Error("invalid");

		delegate.eventStreamDidReceive.mockImplementationOnce(() => {
			throw error;
		});
		sources[0]?.emit("garbage");
		sources[0]?.emit("update");

		expect(delegate.eventStreamDidFail).toHaveBeenCalledExactlyOnceWith(error);
		expect(delegate.eventStreamDidReceive).toHaveBeenLastCalledWith("update");
	});

	it("tells its delegate when the browser closes an open stream", async () => {
		const { delegate } = await open();

		sources[0]?.fail();

		expect(delegate.eventStreamDidClose).not.toHaveBeenCalled();

		sources[0]?.shutDown();

		expect(delegate.eventStreamDidClose).toHaveBeenCalledExactlyOnceWith();
	});

	it("closes the event source", async () => {
		const { stream } = await open();

		stream.close();

		expect(sources[0]?.closed).toBe(true);
	});
});
