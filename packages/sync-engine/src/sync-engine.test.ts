import { LWWMap } from "@goodstate/entities/kinds/lww-map";
import { LWWRegister } from "@goodstate/entities/kinds/lww-register";
import { RGA } from "@goodstate/entities/kinds/rga";
import { Observable } from "@goodstate/observable/observable";
import { array, object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";
import { Time } from "@goodstate/time";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Replica } from "./replica";
import { SyncEngine } from "./sync-engine";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const transportMock = (entries: Record<string, unknown> = {}) => ({
	open: vi.fn<(signal: AbortSignal) => Promise<void>>().mockResolvedValue(undefined),
	pull: vi.fn<(name: string) => Promise<unknown>>().mockImplementation(async (name) => entries[name]),
	push: vi.fn<(name: string, entry: unknown) => Promise<void>>().mockResolvedValue(undefined),
	close: vi.fn<() => void>(),
});

const engines: SyncEngine[] = [];

class TestEngine extends SyncEngine {
	private transport: ReturnType<typeof transportMock>;

	constructor(transport: ReturnType<typeof transportMock>, replica: Replica = new Store(schema), connect = true) {
		super(replica);

		this.transport = transport;
		engines.push(this);

		if (connect) this.session.connect();
	}

	public deliver(entries: Record<string, unknown>): void {
		this.receive(entries);
	}

	public reopen(): void {
		this.session.reopen();
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

	protected push(name: string, entry: unknown): Promise<void> {
		return this.transport.push(name, entry);
	}
}

class StreamEngine extends SyncEngine {
	private readonly transport: ReturnType<typeof transportMock>;

	constructor(transport: ReturnType<typeof transportMock>) {
		super(new Store(schema));
		this.transport = transport;
		engines.push(this);
		this.session.connect();
	}

	protected open(signal: AbortSignal): Promise<void> {
		return this.transport.open(signal);
	}

	protected close(): void {
		this.transport.close();
	}

	protected push(name: string, entry: unknown): Promise<void> {
		return this.transport.push(name, entry);
	}
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

const replicaMock = (data: Record<string, unknown> = {}) => {
	const changes = new Observable<[Readonly<Record<string, unknown>>]>();
	const replica: Replica = {
		schema: { properties: { count: {}, enabled: {}, label: {} } },
		encode: () => ({ data }),
		merge: vi.fn<(name: string, value: unknown) => void>(),
		onChange: (listener) => changes.subscribe(listener),
	};

	return { replica, change: (entries: Readonly<Record<string, unknown>>) => changes.notify(entries) };
};

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
			engine.dispose();
		}
	});

	it("waits for connect before restoring and pushing fields", async () => {
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);
		const sync = new TestEngine(transport, store, false);
		const listener = vi.fn();

		sync.onStateChange(listener);
		await flush();

		expect(sync.idle).toBe(true);
		expect(store.query((state) => state).language).toBe("");
		expect(transport.open).not.toHaveBeenCalled();
		expect(transport.pull).not.toHaveBeenCalled();
		expect(transport.push).not.toHaveBeenCalled();

		sync.connect();

		expect(sync.connecting).toBe(true);
		expect(listener.mock.calls).toStrictEqual([["connecting"]]);

		await flush();

		expect(store.query((state) => state).language).toBe("cs");
		expect(transport.push).toHaveBeenCalledWith("language", expect.objectContaining({ data: "cs" }));
		expect(listener.mock.calls).toStrictEqual([["connecting"], ["connected"]]);
	});

	it("reports a failed open, closes the transport and connects on retry", async () => {
		const transport = transportMock();
		const error = new Error("blocked");
		const sync = new TestEngine(transport, new Store(schema), false);
		const onError = vi.fn();
		const onStateChange = vi.fn();

		transport.open.mockRejectedValueOnce(error);
		sync.onError(onError);
		sync.onStateChange(onStateChange);
		sync.connect();
		await flush();

		expect(onError).toHaveBeenCalledExactlyOnceWith(error);
		expect(onStateChange.mock.calls).toStrictEqual([["connecting"], ["disconnected"]]);
		expect(transport.close).toHaveBeenCalledOnce();
		expect(transport.pull).not.toHaveBeenCalled();

		sync.retry();
		await flush();

		expect(sync.connected).toBe(true);
	});

	it("never connects an engine disposed before startup", async () => {
		const transport = transportMock();
		const sync = new TestEngine(transport, new Store(schema), false);

		sync.dispose();
		sync.connect();
		await flush();

		expect(sync.disposed).toBe(true);
		expect(transport.open).not.toHaveBeenCalled();
		expect(transport.pull).not.toHaveBeenCalled();
		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).not.toHaveBeenCalled();
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
			store.mutate((draft) => {
				draft.language = "cs";
			}),
		).toThrow("ui bug");
		expect(transport.push).toHaveBeenCalledWith("language", expect.objectContaining({ data: "cs" }));
	});

	it("opens the transport, restores each field by name, then pushes every field", async () => {
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);

		void new TestEngine(transport, store);
		await flush();

		expect(transport.open).toHaveBeenCalledOnce();
		expect(transport.pull.mock.calls).toStrictEqual([["tickets"], ["language"]]);
		expect(store.query((state) => state).language).toBe("cs");
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(Math.min(...transport.push.mock.invocationCallOrder)).toBeGreaterThan(
			Math.max(...transport.pull.mock.invocationCallOrder),
		);
	});

	it("connects and pushes every field without pulling when the engine has no pull", async () => {
		const transport = transportMock();
		const sync = new StreamEngine(transport);

		await flush();

		expect(sync.state).toBe("connected");
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
	});

	it("pushes an edit made while the transport opens once it connects", async () => {
		const opening = deferred<void>();
		const transport = transportMock();
		const store = new Store(schema);

		transport.open.mockReturnValue(opening.promise);
		void new TestEngine(transport, store);
		store.mutate((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();

		opening.resolve();
		await flush();

		expect(transport.push.mock.calls.filter(([name]) => name === "language")).toStrictEqual([
			["language", expect.objectContaining({ data: "cs" })],
		]);
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
			store.mutate((draft) => {
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
		store.mutate((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(onError).toHaveBeenCalledExactlyOnceWith(error);

		store.mutate((draft) => {
			draft.language = "en";
		});

		expect(transport.push).toHaveBeenCalledTimes(2);
		expect(transport.push).toHaveBeenNthCalledWith(2, "language", expect.objectContaining({ data: "en" }));
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("disposing while the transport opens never pulls or pushes", async () => {
		const opening = deferred<void>();
		const transport = transportMock();

		transport.open.mockReturnValue(opening.promise);

		const sync = new TestEngine(transport);

		sync.dispose();
		opening.resolve();
		await flush();

		expect(transport.pull).not.toHaveBeenCalled();
		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("disposing while pulling doesn't merge the pulled value", async () => {
		const pulling = deferred<unknown>();
		const transport = transportMock({ language: new LWWRegister("cs", "language", Time.now()).encode() });
		const store = new Store(schema);

		transport.pull.mockReturnValueOnce(pulling.promise);

		const sync = new TestEngine(transport, store);

		await flush();

		expect(transport.pull).toHaveBeenCalledExactlyOnceWith("tickets");

		sync.dispose();
		pulling.resolve(new RGA([new LWWMap({ title: new LWWRegister("First", "title") }, "first")], "tickets").encode());
		await flush();

		expect(store.query((state) => state).tickets).toStrictEqual([]);
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

	it("stops pushing and closes the transport on dispose", async () => {
		const transport = transportMock();
		const store = new Store(schema);
		const sync = new TestEngine(transport, store);

		await flush();
		transport.push.mockClear();
		sync.dispose();
		store.mutate((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("reopening closes and reopens the transport, pulls and pushes every field, then pushes each change once", async () => {
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
		expect(store.query((state) => state).language).toBe("cs");
		expect(transport.push.mock.calls.map(([name]) => name)).toStrictEqual(["tickets", "language"]);
		expect(sync.state).toBe("connected");

		transport.push.mockClear();
		store.mutate((draft) => {
			draft.language = "en";
		});

		expect(transport.push).toHaveBeenCalledExactlyOnceWith("language", expect.objectContaining({ data: "en" }));
	});

	it("merges only the received fields", async () => {
		const store = new Store(schema);
		const sync = new TestEngine(transportMock(), store);

		await flush();
		store.mutate((draft) => {
			draft.tickets.push({ title: "First" });
		});
		sync.deliver({ language: new LWWRegister("cs", "language", Time.now()).encode() });

		expect(store.query((state) => state)).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
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

			expect(sync.state).toBe("disconnected");
			expect(onError).not.toHaveBeenCalled();
			expect(transport.close).toHaveBeenCalledOnce();

			store.mutate((draft) => {
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

			expect(sync.state).toBe("disconnected");
			expect(onError).not.toHaveBeenCalled();
			expect(transport.pull).not.toHaveBeenCalled();
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

	describe("replicas", () => {
		it("pushes entries under their record names", async () => {
			const transport = transportMock();
			const { replica, change } = replicaMock({ count: 1, enabled: true });

			void new TestEngine(transport, replica);
			await flush();

			expect(transport.push.mock.calls).toStrictEqual([
				["count", 1],
				["enabled", true],
			]);

			transport.push.mockClear();
			change({ label: "" });

			expect(transport.push).toHaveBeenCalledExactlyOnceWith("label", "");
		});

		it("merges falsy pulled entries and skips missing ones", async () => {
			const { replica } = replicaMock();

			void new TestEngine(transportMock({ count: 0, enabled: false }), replica);
			await flush();

			expect(vi.mocked(replica.merge).mock.calls).toStrictEqual([
				["count", 0],
				["enabled", false],
			]);
		});
	});
});
