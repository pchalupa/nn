import { describe, expect, it, vi } from "vitest";

import { Session, type SessionDelegate, SessionEvent, SessionState } from "./session";

const transitions: Array<[SessionState, SessionEvent, SessionState]> = [
	[SessionState.Idle, SessionEvent.Connect, SessionState.Connecting],
	[SessionState.Connecting, SessionEvent.Succeed, SessionState.Connected],
	[SessionState.Connecting, SessionEvent.Fail, SessionState.Disconnected],
	[SessionState.Connecting, SessionEvent.Drop, SessionState.Disconnected],
	[SessionState.Connected, SessionEvent.Drop, SessionState.Disconnected],
	[SessionState.Connected, SessionEvent.Reconnect, SessionState.Connecting],
	[SessionState.Idle, SessionEvent.Detach, SessionState.Detached],
	[SessionState.Connecting, SessionEvent.Detach, SessionState.Detached],
	[SessionState.Connected, SessionEvent.Detach, SessionState.Detached],
	[SessionState.Disconnected, SessionEvent.Detach, SessionState.Detached],
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
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();

		expect(session.connecting).toBe(true);

		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledExactlyOnceWith(session, expect.any(AbortSignal));
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(false);
		expect(delegate.sessionDidOpen).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionDidOpen).toHaveBeenCalledAfter(delegate.sessionOpen);
		expect(session.connected).toBe(true);
	});

	it("ignores connect when already connected", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		session.connect();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionDidOpen).toHaveBeenCalledOnce();
	});

	it("stays connecting while sessionOpen is pending", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
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
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		session.delegate = delegate;
		session.connect();
		await flush();
		session.connect();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionDidOpen).not.toHaveBeenCalled();
		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(session.disconnected).toBe(true);
	});

	it("closes once and aborts the signal on drop", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		session.drop();
		session.drop();

		expect(session.disconnected).toBe(true);

		session.detach();

		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);
	});

	it("closes, then opens a new attempt on reconnect", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();

		const signal = delegate.sessionOpen.mock.lastCall?.[1];

		delegate.sessionOpen.mockClear();
		session.reconnect();

		expect(signal?.aborted).toBe(true);
		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionOpen).toHaveBeenCalledAfter(delegate.sessionDidClose);
		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(false);
		expect(session.connecting).toBe(true);

		await flush();

		expect(delegate.sessionDidOpen).toHaveBeenCalledTimes(2);
		expect(session.connected).toBe(true);
	});

	it("ignores reconnect while connecting", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		session.reconnect();
		await flush();

		expect(delegate.sessionOpen).toHaveBeenCalledOnce();
		expect(delegate.sessionDidClose).not.toHaveBeenCalled();
		expect(session.connected).toBe(true);
	});

	it("disconnects when a reconnect attempt fails", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		await flush();
		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		session.reconnect();
		await flush();

		expect(delegate.sessionDidClose).toHaveBeenCalledTimes(2);
		expect(session.disconnected).toBe(true);
	});

	it("ignores drop when idle or detached", () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.drop();

		expect(session.idle).toBe(true);

		session.detach();
		session.drop();

		expect(session.detached).toBe(true);
		expect(delegate.sessionDidClose).not.toHaveBeenCalled();
	});

	it("handles detach from inside sessionDidClose after the close", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		delegate.sessionOpen.mockRejectedValueOnce(new Error("failure"));
		delegate.sessionDidClose.mockImplementation(() => session.detach());
		session.delegate = delegate;
		session.connect();
		await flush();

		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(session.detached).toBe(true);
	});

	it("handles drop from inside sessionDidOpen after the open", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		delegate.sessionDidOpen.mockImplementation(() => session.drop());
		session.delegate = delegate;
		session.connect();
		await flush();

		expect(delegate.sessionDidOpen).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);
		expect(delegate.sessionDidClose).toHaveBeenCalledAfter(delegate.sessionDidOpen);
		expect(session.disconnected).toBe(true);
	});

	it("ignores an open that settles after detach", async () => {
		const session = new Session();
		const delegate = {
			sessionOpen: vi.fn<SessionDelegate["sessionOpen"]>(),
			sessionDidOpen: vi.fn(),
			sessionDidClose: vi.fn(),
		};

		session.delegate = delegate;
		session.connect();
		session.detach();

		expect(delegate.sessionOpen.mock.lastCall?.[1].aborted).toBe(true);
		expect(delegate.sessionDidClose).toHaveBeenCalledExactlyOnceWith(session);

		await flush();

		expect(delegate.sessionDidOpen).not.toHaveBeenCalled();
		expect(session.detached).toBe(true);
	});
});
