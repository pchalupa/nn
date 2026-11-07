import type { Encoded } from "@nn/entities/codable";
import { LWWMap } from "@nn/entities/kinds/lww-map";
import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { RGA } from "@nn/entities/kinds/rga";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { Time } from "@nn/time";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import { SyncEngine, SyncState } from "./sync-engine";

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

	public connectAgain(): void {
		this.session.connect();
	}

	public reopen(): void {
		this.session.reconnect();
	}

	public lose(): void {
		this.session.drop();
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

class StreamEngine extends SyncEngine {
	constructor(private readonly transport: ReturnType<typeof transportMock>) {
		super(new Store(schema));
		engines.push(this);
		this.session.connect();
	}

	protected open(signal: AbortSignal): Promise<void> {
		return this.transport.open(signal);
	}

	protected close(): void {
		this.transport.close();
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
			engine.detach();
		}
	});

	it("reads connecting right after the connection starts", () => {
		expect(new StreamEngine(transportMock()).state).toBe(SyncState.Connecting);
	});

	it("tells state listeners about each transition until they unsubscribe", async () => {
		const sync = new StreamEngine(transportMock());
		const listener = vi.fn();
		const off = sync.onStateChange(listener);

		await flush();
		off();
		sync.detach();

		expect(listener.mock.calls).toStrictEqual([[SyncState.Connected]]);
	});

	it("retries from disconnected", async () => {
		const transport = transportMock();

		transport.open.mockRejectedValueOnce(new Error("down"));

		const sync = new StreamEngine(transport);

		await flush();
		expect(sync.disconnected).toBe(true);

		sync.retry();
		await flush();

		expect(sync.connected).toBe(true);
	});

	it("drops failures silently when nobody listens", async () => {
		const transport = transportMock();

		transport.push.mockRejectedValue(new Error("rejected"));

		const sync = new StreamEngine(transport);

		await flush();

		expect(sync.connected).toBe(true);
	});

	it("reports a failed open as a state change and an error", async () => {
		const transport = transportMock();
		const error = new Error("blocked");
		const onError = vi.fn();
		const onStateChange = vi.fn();

		transport.open.mockRejectedValue(error);

		const sync = new StreamEngine(transport);

		sync.onError(onError);
		sync.onStateChange(onStateChange);
		await flush();

		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(onStateChange.mock.calls).toStrictEqual([[SyncState.Disconnected]]);
	});

	it("pushes an edit even when an app change listener throws", async () => {
		const transport = transportMock();
		const store = new Store(schema);

		store.onChange(() => {
			throw new Error("ui bug");
		});
		void new TestEngine(transport, store);
		await flush();
		transport.push.mockClear();

		expect(() =>
			store.update((draft) => {
				draft.language = "cs";
			}),
		).toThrow("ui bug");
		expect(transport.push).toHaveBeenCalledWith("language", expect.objectContaining({ data: "cs" }));
	});

	it("hides the session and the delegate", () => {
		expectTypeOf<SyncEngine>().not.toHaveProperty("session");
		expectTypeOf<SyncEngine>().not.toHaveProperty("delegate");
	});

	it("opens the transport and restores each field by name", async () => {
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();

		expect(transport.open).toHaveBeenCalledOnce();
		expect(transport.pull.mock.calls).toStrictEqual([["tickets"], ["language"]]);
		expect(store.read().language).toBe("cs");
	});

	it("connects and pushes every field without pulling when the engine has no pull", async () => {
		const transport = transportMock();
		const sync = new StreamEngine(transport);

		await flush();

		expect(sync.state).toBe(SyncState.Connected);
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
	});

	it("keeps defaults for fields without a stored entry", async () => {
		const transport = transportMock();
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();

		expect(store.read()).toStrictEqual({ tickets: [], language: "" });
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
		store.update((draft) => {
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
		store.update((draft) => {
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
			store.update((draft) => {
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
		const onError = vi.fn();

		await flush();
		transport.push.mockClear();
		sync.onError(onError);
		transport.push.mockRejectedValueOnce(error);
		store.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(onError).toHaveBeenCalledExactlyOnceWith(error);

		store.update((draft) => {
			draft.language = "en";
		});

		expect(transport.push).toHaveBeenCalledTimes(2);
		expect(transport.push).toHaveBeenNthCalledWith(2, "language", expect.objectContaining({ data: "en" }));
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("reports a failed open and closes the transport", async () => {
		const transport = transportMock();
		const error = new Error("blocked");
		const onError = vi.fn();

		transport.open.mockRejectedValue(error);

		const sync = new TestEngine(transport);

		sync.onError(onError);
		await flush();

		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(transport.close).toHaveBeenCalledOnce();
		expect(transport.pull).not.toHaveBeenCalled();
	});

	it("detaching while the transport opens never pulls or pushes", async () => {
		const opening = deferred<void>();
		const transport = transportMock();

		transport.open.mockReturnValue(opening.promise);

		const sync = new TestEngine(transport);

		sync.detach();
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

		sync.detach();
		pulling.resolve(new RGA([new LWWMap({ title: new LWWRegister("First", "title") }, "first")], "tickets").encode());
		await flush();

		expect(store.read().tickets).toStrictEqual([]);
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
		sync.detach();
		store.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("detaching twice closes the transport once", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport);

		await flush();
		sync.detach();
		sync.detach();

		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("aborts the signal given to open on detach", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport);

		await flush();
		sync.detach();

		expect(transport.open.mock.lastCall?.[0].aborted).toBe(true);
	});

	it("a second attach doesn't connect again", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		transport.push.mockClear();
		sync.connectAgain();
		await flush();

		expect(transport.open).toHaveBeenCalledOnce();

		store.update((draft) => {
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
		sync.reopen();

		expect(transport.close).toHaveBeenCalledOnce();

		await flush();

		expect(transport.open).toHaveBeenCalledTimes(2);
		expect(store.read().language).toBe("cs");
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(sync.state).toBe(SyncState.Connected);
	});

	it("pushes each change once after reconnecting", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		sync.reopen();
		await flush();
		transport.push.mockClear();
		store.update((draft) => {
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

		expect(store.read().language).toBe("cs");
	});

	it("merges only the received fields", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();
		store.update((draft) => {
			draft.tickets.push({ title: "First" });
		});
		sync.deliver({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		expect(store.read()).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
	});

	it("throws on a received entry that cannot be decoded", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();

		expect(() => sync.deliver({ tickets: {}, language: {} })).toThrow("Invalid encoded entity.");
		expect(store.read().language).toBe("");
	});

	describe("dropping", () => {
		it("closes when the transport is lost, stops pushing and reports nothing", async () => {
			const transport = transportMock();
			const onError = vi.fn();
			const store = new Store(schema);
			const sync = new TestEngine(transport, store);

			await flush();
			transport.push.mockClear();
			sync.onError(onError);
			sync.lose();
			sync.lose();

			expect(sync.state).toBe(SyncState.Disconnected);
			expect(onError).not.toHaveBeenCalled();
			expect(transport.close).toHaveBeenCalledOnce();

			store.update((draft) => {
				draft.language = "cs";
			});
			await flush();

			expect(transport.push).not.toHaveBeenCalled();
			expect(transport.open).toHaveBeenCalledOnce();
		});

		it("treats a lost connection while opening as a failed attempt", async () => {
			const opening = deferred<void>();
			const transport = transportMock();
			const onError = vi.fn();

			transport.open.mockReturnValueOnce(opening.promise);

			const sync = new TestEngine(transport);

			sync.onError(onError);
			sync.lose();

			expect(transport.close).toHaveBeenCalledOnce();

			opening.reject(new Error("aborted"));
			await flush();

			expect(sync.state).toBe(SyncState.Disconnected);
			expect(onError).not.toHaveBeenCalled();
			expect(transport.pull).not.toHaveBeenCalled();
		});

		it("fails the attempt when a pulled entry can't be decoded", async () => {
			const transport = transportMock({ language: {} });
			const onError = vi.fn();
			const sync = new TestEngine(transport);

			sync.onError(onError);
			await flush();

			expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Invalid encoded entity." }));
			expect(transport.close).toHaveBeenCalledOnce();
			expect(transport.push).not.toHaveBeenCalled();
		});

		it("fails the attempt when a pull rejects", async () => {
			const transport = transportMock();
			const error = new Error("read failed");
			const onError = vi.fn();

			transport.pull.mockImplementation(async (name) => {
				if (name === "language") throw error;
			});

			const sync = new TestEngine(transport);

			sync.onError(onError);
			await flush();

			expect(onError).toHaveBeenCalledExactlyOnceWith(error);
			expect(transport.close).toHaveBeenCalledOnce();
			expect(transport.push).not.toHaveBeenCalled();
		});
	});
});
