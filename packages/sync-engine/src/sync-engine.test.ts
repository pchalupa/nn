import type { Encoded } from "@nn/entities/codable";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { Time } from "@nn/time";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionState } from "./session";
import { SyncEngine } from "./sync-engine";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const transportMock = (entries: Record<string, unknown> = {}) => ({
	open: vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined),
	pull: vi.fn<(name: string) => Promise<unknown>>().mockImplementation(async (name) => entries[name]),
	push: vi.fn<(name: string, entry: Encoded) => Promise<void>>().mockResolvedValue(undefined),
	close: vi.fn<() => void>(),
});

const engines: SyncEngine[] = [];

class TestEngine extends SyncEngine {
	constructor(
		private readonly transport: ReturnType<typeof transportMock>,
		store = new Store(schema),
	) {
		super(store);
		engines.push(this);
		this.session.connect();
	}

	public deliver(entries: Record<string, unknown>): void {
		this.receive(entries);
	}

	protected open(signal: AbortSignal): Promise<void> {
		return this.transport.open(signal);
	}

	protected close(): void {
		this.transport.close();
	}

	protected pull(name: string): Promise<unknown> {
		return this.transport.pull(name);
	}

	protected push(name: string, entry: Encoded): Promise<void> {
		return this.transport.push(name, entry);
	}
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

const deferred = <T>() => {
	let resolve: (value: T) => void = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<T>((onResolve, onReject) => {
		resolve = onResolve;
		reject = onReject;
	});

	return { promise, resolve, reject };
};

describe("SyncEngine", () => {
	afterEach(() => {
		for (const engine of engines.splice(0)) {
			engine.session.detach();
		}
	});

	it("opens the transport and restores each field by name", async () => {
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();

		expect(transport.open).toHaveBeenCalledOnce();
		expect(transport.pull.mock.calls).toStrictEqual([["tickets"], ["language"]]);
		expect(store.state.read().language).toBe("cs");
	});

	it("keeps defaults for fields without a stored entry", async () => {
		const transport = transportMock();
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();

		expect(store.state.read()).toStrictEqual({ tickets: [], language: "" });
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("pushes every field once connected", async () => {
		const transport = transportMock();

		void new TestEngine(transport);
		await flush();

		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(Math.min(...transport.push.mock.invocationCallOrder)).toBeGreaterThan(
			Math.max(...transport.pull.mock.invocationCallOrder),
		);
	});

	it("pushes the restored value of each field", async () => {
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		void new TestEngine(transport);
		await flush();

		expect(transport.push).toHaveBeenCalledWith("language", expect.objectContaining({ key: "language", data: "cs" }));
	});

	it("pushes an edit made while the transport opens once it connects", async () => {
		const opening = deferred<void>();
		const transport = transportMock();
		const store = new Store(schema);

		transport.open.mockReturnValue(opening.promise);
		void new TestEngine(transport, store);
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();

		opening.resolve();
		await flush();

		expect(transport.push.mock.calls.filter(([name]) => name === "language")).toStrictEqual([
			["language", expect.objectContaining({ data: "cs" })],
		]);
	});

	it("pushes each changed field under its name", async () => {
		const transport = transportMock();
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();
		transport.push.mockClear();
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" });
			draft.language = "cs";
		});

		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(transport.push).toHaveBeenLastCalledWith(
			"language",
			expect.objectContaining({ key: "language", data: "cs" }),
		);
	});

	it("pushes each change while an earlier push of the field is pending", async () => {
		const pushing = deferred<void>();
		const transport = transportMock();
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();
		transport.push.mockClear();
		transport.push.mockReturnValueOnce(pushing.promise);

		for (const language of ["cs", "en", "de"]) {
			store.state.update((draft) => {
				draft.language = language;
			});
		}

		expect(transport.push.mock.calls.map(([, entry]) => entry)).toStrictEqual([
			expect.objectContaining({ data: "cs" }),
			expect.objectContaining({ data: "en" }),
			expect.objectContaining({ data: "de" }),
		]);

		pushing.resolve();
	});

	it("reports a rejected push and keeps pushing later edits", async () => {
		const transport = transportMock();
		const error = new Error("write failed");
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);
		const delegate = { syncEngineDidFail: vi.fn() };

		await flush();
		transport.push.mockClear();
		sync.delegate = delegate;
		transport.push.mockRejectedValueOnce(error);
		store.state.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(delegate.syncEngineDidFail).toHaveBeenCalledExactlyOnceWith(sync, error);

		store.state.update((draft) => {
			draft.language = "en";
		});

		expect(transport.push).toHaveBeenCalledTimes(2);
		expect(transport.push).toHaveBeenNthCalledWith(2, "language", expect.objectContaining({ data: "en" }));
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("reports a failed open and closes the transport", async () => {
		const transport = transportMock();
		const error = new Error("blocked");
		const delegate = { syncEngineDidFail: vi.fn() };

		transport.open.mockRejectedValue(error);

		const sync = new TestEngine(transport);

		sync.delegate = delegate;
		await flush();

		expect(delegate.syncEngineDidFail).toHaveBeenCalledExactlyOnceWith(sync, error);
		expect(transport.close).toHaveBeenCalledOnce();
		expect(transport.pull).not.toHaveBeenCalled();
	});

	it("detaching while the transport opens never pulls or pushes", async () => {
		const opening = deferred<void>();
		const transport = transportMock();

		transport.open.mockReturnValue(opening.promise);

		const sync = new TestEngine(transport);

		sync.session.detach();
		opening.resolve();
		await flush();

		expect(transport.pull).not.toHaveBeenCalled();
		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("detaching while pulling doesn't merge the pulled value", async () => {
		const pulling = deferred<unknown>();
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);

		transport.pull.mockReturnValueOnce(pulling.promise);

		const sync = new TestEngine(transport, store);

		await flush();

		expect(transport.pull).toHaveBeenCalledExactlyOnceWith("tickets");

		sync.session.detach();
		pulling.resolve(new RGA([new LWWMap({ title: new LWWRegister("First", "title") }, "first")], "tickets").encode());
		await flush();

		expect(store.state.read().tickets).toStrictEqual([]);
		expect(transport.pull).toHaveBeenCalledOnce();
		expect(transport.push).not.toHaveBeenCalled();
	});

	it("pushes a received entry back when it changes the store", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport);

		await flush();
		sync.deliver({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		expect(transport.push).toHaveBeenCalledWith("language", expect.objectContaining({ data: "cs" }));
	});

	it("stops pushing and closes the transport on detach", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		transport.push.mockClear();
		sync.session.detach();
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("detaching twice closes the transport once", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport);

		await flush();
		sync.session.detach();
		sync.session.detach();

		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("aborts the signal given to open on detach", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport);

		await flush();
		sync.session.detach();

		expect(transport.open.mock.lastCall?.[0].aborted).toBe(true);
	});

	it("a second attach doesn't connect again", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		transport.push.mockClear();
		sync.session.connect();
		await flush();

		expect(transport.open).toHaveBeenCalledOnce();

		store.state.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(transport.push).toHaveBeenCalledExactlyOnceWith("language", expect.objectContaining({ data: "cs" }));
	});

	it("reconnecting closes and reopens the transport, then pulls and pushes every field", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		transport.push.mockClear();
		transport.pull.mockImplementation(async (name) =>
			name === "language" ? new LWWRegister("cs", "language", Time.now()).encode() : undefined,
		);
		sync.session.reconnect();

		expect(transport.close).toHaveBeenCalledOnce();

		await flush();

		expect(transport.open).toHaveBeenCalledTimes(2);
		expect(store.state.read().language).toBe("cs");
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(sync.session.state).toBe(SessionState.Connected);
	});

	it("pushes each change once after reconnecting", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		sync.session.reconnect();
		await flush();
		transport.push.mockClear();
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).toHaveBeenCalledExactlyOnceWith("language", expect.objectContaining({ data: "cs" }));
	});

	it("merges received entries into the store", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();
		sync.deliver({
			tickets: new RGA([], "tickets").encode(),
			language: new LWWRegister("cs", "language", Time.now()).encode(),
		});

		expect(store.state.read().language).toBe("cs");
	});

	it("merges only the received fields", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();
		store.state.update((draft) => {
			draft.tickets.push({ title: "First" });
		});
		sync.deliver({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		expect(store.state.read()).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
	});

	it("throws on a received entry that cannot be decoded", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();

		expect(() => sync.deliver({ tickets: {}, language: {} })).toThrow("Invalid encoded entity.");
		expect(store.state.read().language).toBe("");
	});

	describe("dropping", () => {
		it("closes when the transport is lost, stops pushing and reports nothing", async () => {
			const transport = transportMock();
			const delegate = { syncEngineDidFail: vi.fn() };
			const store = new Store(schema);
			const sync = new TestEngine(transport, store);

			await flush();
			transport.push.mockClear();
			sync.delegate = delegate;
			sync.session.drop();
			sync.session.drop();

			expect(sync.session.state).toBe(SessionState.Disconnected);
			expect(delegate.syncEngineDidFail).not.toHaveBeenCalled();
			expect(transport.close).toHaveBeenCalledOnce();

			store.state.update((draft) => {
				draft.language = "cs";
			});
			await flush();

			expect(transport.push).not.toHaveBeenCalled();
			expect(transport.open).toHaveBeenCalledOnce();
		});

		it("treats a lost connection while opening as a failed attempt", async () => {
			const opening = deferred<void>();
			const transport = transportMock();
			const delegate = { syncEngineDidFail: vi.fn() };

			transport.open.mockReturnValueOnce(opening.promise);

			const sync = new TestEngine(transport);

			sync.delegate = delegate;
			sync.session.drop();

			expect(transport.close).toHaveBeenCalledOnce();

			opening.reject(new Error("aborted"));
			await flush();

			expect(sync.session.state).toBe(SessionState.Disconnected);
			expect(delegate.syncEngineDidFail).not.toHaveBeenCalled();
			expect(transport.pull).not.toHaveBeenCalled();
		});

		it("fails the attempt when a pulled entry can't be decoded", async () => {
			const transport = transportMock({ language: {} });
			const delegate = { syncEngineDidFail: vi.fn() };
			const sync = new TestEngine(transport);

			sync.delegate = delegate;
			await flush();

			expect(delegate.syncEngineDidFail).toHaveBeenCalledExactlyOnceWith(
				sync,
				expect.objectContaining({ message: "Invalid encoded entity." }),
			);
			expect(transport.close).toHaveBeenCalledOnce();
			expect(transport.push).not.toHaveBeenCalled();
		});

		it("fails the attempt when a pull rejects", async () => {
			const transport = transportMock();
			const error = new Error("read failed");
			const delegate = { syncEngineDidFail: vi.fn() };

			transport.pull.mockImplementation(async (name) => {
				if (name === "language") throw error;
			});

			const sync = new TestEngine(transport);

			sync.delegate = delegate;
			await flush();

			expect(delegate.syncEngineDidFail).toHaveBeenCalledExactlyOnceWith(sync, error);
			expect(transport.close).toHaveBeenCalledOnce();
			expect(transport.push).not.toHaveBeenCalled();
		});
	});
});
