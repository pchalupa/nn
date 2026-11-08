import { describe, expect, it, vi } from "vitest";

import { Session, type SessionDelegate, SessionEvent, SessionState } from "./session";

const transitions: Array<[SessionState, SessionEvent, SessionState]> = [
	[SessionState.Idle, SessionEvent.Connect, SessionState.Connecting],
	[SessionState.Connecting, SessionEvent.Succeed, SessionState.Connected],
	[SessionState.Connecting, SessionEvent.Fail, SessionState.Disconnected],
	[SessionState.Connecting, SessionEvent.Drop, SessionState.Disconnected],
	[SessionState.Connected, SessionEvent.Drop, SessionState.Disconnected],
	[SessionState.Connected, SessionEvent.Reopen, SessionState.Connecting],
	[SessionState.Disconnected, SessionEvent.Retry, SessionState.Connecting],
	[SessionState.Idle, SessionEvent.Dispose, SessionState.Disposed],
	[SessionState.Connecting, SessionEvent.Dispose, SessionState.Disposed],
	[SessionState.Connected, SessionEvent.Dispose, SessionState.Disposed],
	[SessionState.Disconnected, SessionEvent.Dispose, SessionState.Disposed],
];

describe("Session.transition", () => {
	it.each(
		Object.values(SessionState).flatMap((from) =>
			Object.values(SessionEvent).map((event): [SessionState, SessionEvent, SessionState] => [
				from,
				event,
				transitions.find(([state, on]) => state === from && on === event)?.[2] ?? from,
			]),
		),
	)("moves from %s on %s to %s", (from, event, expected) => {
		expect(Session.transition(from, event)).toBe(expected);
	});
});

describe("Session", () => {
	const flush = () => new Promise((resolve) => setTimeout(resolve));

	it("starts idle", () => {
		expect(new Session().idle).toBe(true);
	});

	it("connects once sessionOpen resolves", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();

		expect(session.connecting).toBe(true);

		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledExactlyOnceWith(session, expect.any(AbortSignal));
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(false);
		expect(delegate.sessionDidConnect).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionDidConnect).toHaveBeenCalledAfter(delegate.sessionOpen);
		expect(session.connected).toBe(true);
	});

	it("ignores connect when already connected", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		session.connect();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionDidConnect).toHaveBeenCalledOnce();
	});

	it("stays connecting while sessionOpen is pending", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		delegate.sessionOpen.mockReturnValueOnce(new Promise(() => {}));
		session.delegate = delegate;
		session.connect();
		await flush();

		expect(session.connecting).toBe(true);
	});

	it("disconnects for good when sessionOpen rejects", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		session.delegate = delegate;
		session.connect();
		await flush();
		session.connect();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionDidConnect).not.toHaveBeenCalled();
		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(session.disconnected).toBe(true);
	});

	it("closes once and aborts the signal on drop", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		session.drop();
		session.drop();

		expect(session.disconnected).toBe(true);

		session.dispose();

		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);
	});

	it("closes, then opens a new attempt on reopen", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();

		const signal = delegate.sessionOpen.mock.lastCall?.[1];

		delegate.sessionOpen.mockClear();
		session.reopen();

		expect(signal?.aborted).toBe(true);
		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionOpen).toHaveBeenCalledAfter(delegate.sessionClose);
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(false);
		expect(session.connecting).toBe(true);

		await flush();

		expect(delegate.sessionDidConnect).toHaveBeenCalledTimes(2);
		expect(session.connected).toBe(true);
	});

	it("ignores reopen while connecting", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		session.reopen();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionClose).not.toHaveBeenCalled();
		expect(session.connected).toBe(true);
	});

	it("disconnects when a reopen attempt fails", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		session.reopen();
		await flush();

		expect(delegate.sessionClose).toHaveBeenCalledTimes(2);
		expect(session.disconnected).toBe(true);
	});

	it("ignores drop when idle or disposed", () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.drop();

		expect(session.idle).toBe(true);

		session.dispose();
		session.drop();

		expect(session.disposed).toBe(true);
		expect(delegate.sessionClose).not.toHaveBeenCalled();
	});

	it("handles dispose from inside sessionClose after the close", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		delegate.sessionClose.mockImplementation(() => session.dispose());
		session.delegate = delegate;
		session.connect();
		await flush();

		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(session.disposed).toBe(true);
	});

	it("handles drop from inside sessionDidConnect after the connect", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		delegate.sessionDidConnect.mockImplementation(() => session.drop());
		session.delegate = delegate;
		session.connect();
		await flush();

		expect(delegate.sessionDidConnect).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionClose).toHaveBeenCalledAfter(delegate.sessionDidConnect);
		expect(session.disconnected).toBe(true);
	});

	it("ignores an open that settles after dispose", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		session.dispose();

		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionClose).toHaveBeenCalledExactlyOnceWith(session);

		await flush();

		expect(delegate.sessionDidConnect).not.toHaveBeenCalled();
		expect(session.disposed).toBe(true);
	});

	it("opens a new attempt on retry after a failed attempt", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		session.delegate = delegate;
		session.connect();
		await flush();
		session.retry();
		await flush();

		expect(session.connected).toBe(true);
		expect(delegate.sessionOpen).toHaveBeenCalledTimes(2);
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(false);
		expect(delegate.sessionClose).toHaveBeenCalledOnce();
	});

	it("ignores retry while connected", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		session.retry();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(session.connected).toBe(true);
	});

	it("notifies changes after each transition's effects", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};
		const records: Array<[SessionState, SessionState, number]> = [];

		session.delegate = delegate;
		session.changes.subscribe((state) => {
			records.push([state, session.state, delegate.sessionDidConnect.mock.calls.length]);
		});
		session.connect();
		await flush();
		session.drop();
		session.retry();
		await flush();
		session.dispose();

		expect(records).toStrictEqual([
			[SessionState.Connecting, SessionState.Connecting, 0],
			[SessionState.Connected, SessionState.Connected, 1],
			[SessionState.Disconnected, SessionState.Disconnected, 1],
			[SessionState.Connecting, SessionState.Connecting, 1],
			[SessionState.Connected, SessionState.Connected, 2],
			[SessionState.Disposed, SessionState.Disposed, 2],
		]);
	});

	it("does not notify ignored events", () => {
		const session = new Session();
		const observer = vi.fn();

		session.changes.subscribe(observer);
		session.drop();
		session.retry();
		session.reopen();

		expect(observer).not.toHaveBeenCalled();
	});

	it("stops notifying after unsubscribe", () => {
		const session = new Session();
		const observer = vi.fn();

		session.changes.subscribe(observer)();
		session.connect();

		expect(observer).not.toHaveBeenCalled();
	});

	it("queues an event sent from a changes observer", () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidConnect: vi.fn(),
			sessionClose: vi.fn(),
		};
		const statesAfterDispose: SessionState[] = [];
		const observer = vi.fn((state: SessionState) => {
			if (state === SessionState.Connecting) {
				session.dispose();
				statesAfterDispose.push(session.state);
			}
		});
		const laterObserver = vi.fn();

		session.delegate = delegate;
		session.changes.subscribe(observer);
		session.changes.subscribe(laterObserver);
		session.connect();

		expect(statesAfterDispose).toStrictEqual([SessionState.Connecting]);
		expect(observer.mock.calls).toStrictEqual([[SessionState.Connecting], [SessionState.Disposed]]);
		expect(laterObserver.mock.calls).toStrictEqual([[SessionState.Connecting], [SessionState.Disposed]]);
		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionClose).toHaveBeenCalledOnce();
	});
});
