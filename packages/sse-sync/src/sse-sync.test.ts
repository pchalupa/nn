import { LWWRegister } from "@nn/entities/kinds/lww-register";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SseSync } from "./sse-sync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

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

	public emit(data: string): void {
		this.onmessage?.(new MessageEvent("message", { data }));
	}

	public shutDown(): void {
		this.readyState = FakeEventSource.CLOSED;
		this.onerror?.();
	}
}

const fetchMock = vi.fn<typeof fetch>();

const pushes = () =>
	fetchMock.mock.calls.map(([url, init]): { url: string; method?: string; body: unknown } => ({
		url: String(url),
		method: init?.method,
		body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
	}));

const language = (value: string) => JSON.stringify({ language: new LWWRegister(value, "language").encode() });

const engines: SseSync[] = [];

const attach = async ({ url = "http://remote.test", snapshot = "{}" } = {}) => {
	const store = new Store(schema);
	const sync = SseSync.attach(store, new URL(url));
	const syncEngineDidFail = vi.fn();

	sync.onError(syncEngineDidFail);
	engines.push(sync);
	sources.at(-1)?.emit(snapshot);

	await vi.waitFor(() => {
		expect(sync.connecting).toBe(false);
	});

	return { store, sync, syncEngineDidFail };
};

const editTickets = (store: Store<typeof schema>) =>
	store.update((draft) => {
		draft.tickets.push({ title: "Offline" });
	});

describe("SseSync", () => {
	beforeEach(() => {
		sources = [];
		fetchMock.mockReset().mockImplementation(async () => new Response());
		vi.stubGlobal("fetch", fetchMock);
		vi.stubGlobal("EventSource", FakeEventSource);
	});

	afterEach(() => {
		for (const engine of engines.splice(0)) engine.detach();

		vi.unstubAllGlobals();
	});

	it.each(["http://remote.test/api", "http://remote.test/api/"])(
		"resolves endpoints under the base URL path %s",
		async (url) => {
			await attach({ url });

			expect(sources[0]?.url).toBe("http://remote.test/api/subscribe");
			await vi.waitFor(() => {
				expect(pushes()[0]?.url).toBe("http://remote.test/api/push");
			});
		},
	);

	it("bootstraps the store from the first event", async () => {
		const { store } = await attach({ snapshot: language("cs") });

		expect(store.read().language).toBe("cs");
	});

	it("merges fields carried by later events", async () => {
		const { store } = await attach();

		sources[0]?.emit(language("cs"));

		expect(store.read().language).toBe("cs");
	});

	it("posts each changed field on its own", async () => {
		const { store } = await attach();

		store.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(() => {
			expect(pushes()).toContainEqual({
				url: "http://remote.test/push",
				method: "POST",
				body: { language: expect.objectContaining({ data: "cs" }) },
			});
		});
	});

	it("reports a failed push to error listeners", async () => {
		fetchMock.mockImplementation(async () => new Response(null, { status: 500 }));

		const { syncEngineDidFail } = await attach();

		await vi.waitFor(() => {
			expect(syncEngineDidFail).toHaveBeenCalledWith(expect.any(Error));
		});
	});

	it("reports an event it cannot parse or decode and keeps listening", async () => {
		const { store, syncEngineDidFail } = await attach();

		sources[0]?.emit("update");
		sources[0]?.emit("[]");
		sources[0]?.emit(JSON.stringify({ language: "garbage" }));
		sources[0]?.emit(language("cs"));

		expect(syncEngineDidFail).toHaveBeenCalledTimes(3);
		expect(store.read().language).toBe("cs");
	});

	it.each([
		["is not JSON", "update"],
		["is not an object", "[]"],
		["carries a field that is not an encoded entity", JSON.stringify({ tickets: [] })],
	])("disconnects and reports the failure when the first event %s", async (_reason, snapshot) => {
		const { sync, syncEngineDidFail } = await attach({ snapshot });

		expect(sync.disconnected).toBe(true);
		expect(syncEngineDidFail).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
		expect(sources[0]?.closed).toBe(true);
	});

	it("waits disconnected after the browser closes the stream for good", async () => {
		const { sync } = await attach();

		sources[0]?.shutDown();

		expect(sync.disconnected).toBe(true);
		expect(sources).toHaveLength(1);
		expect(sources[0]?.closed).toBe(true);
	});

	it("stays disconnected when the store changes", async () => {
		const { store, sync } = await attach();

		sources[0]?.shutDown();
		editTickets(store);
		await Promise.resolve();

		expect(sync.disconnected).toBe(true);
		expect(sources).toHaveLength(1);
	});

	it("reopens the stream when the app retries", async () => {
		const { store, sync } = await attach();

		sources[0]?.shutDown();
		sync.retry();

		expect(sources).toHaveLength(2);

		sources[1]?.emit(language("cs"));

		await vi.waitFor(() => {
			expect(sync.connected).toBe(true);
		});
		expect(store.read().language).toBe("cs");
	});

	it("opens one stream for several retries", async () => {
		const { sync } = await attach();

		sources[0]?.shutDown();
		sync.retry();
		sync.retry();

		expect(sources).toHaveLength(2);
	});

	it("ignores retries while connected", async () => {
		const { sync } = await attach();

		sync.retry();

		expect(sources).toHaveLength(1);
	});

	it("retries after a first event it cannot read", async () => {
		const { sync } = await attach({ snapshot: "[]" });

		sync.retry();

		expect(sources).toHaveLength(2);
	});

	it("retries again after a failed retry", async () => {
		const { sync, syncEngineDidFail } = await attach();

		sources[0]?.shutDown();
		sync.retry();
		sources[1]?.shutDown();

		await vi.waitFor(() => {
			expect(sync.disconnected).toBe(true);
		});
		expect(syncEngineDidFail).toHaveBeenCalledWith(expect.any(Error));

		sync.retry();

		expect(sources).toHaveLength(3);
	});

	it("pushes an edit made while disconnected once the retry connects", async () => {
		const { store, sync } = await attach();

		sources[0]?.shutDown();
		store.update((draft) => {
			draft.language = "en";
		});
		sync.retry();

		const edit = {
			url: "http://remote.test/push",
			method: "POST",
			body: { language: expect.objectContaining({ data: "en" }) },
		};

		expect(sources).toHaveLength(2);
		expect(pushes()).not.toContainEqual(edit);

		sources[1]?.emit("{}");

		await vi.waitFor(() => {
			expect(pushes()).toContainEqual(edit);
		});
	});

	it("closes the event stream on detach", async () => {
		const { sync } = await attach();

		sync.detach();

		expect(sources[0]?.closed).toBe(true);
	});
});
