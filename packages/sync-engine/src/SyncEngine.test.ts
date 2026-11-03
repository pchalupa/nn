import type { Encoded } from "@nn/entities/Codable";
import { LWWRegister } from "@nn/entities/kinds/LWWRegister";
import { RGA } from "@nn/entities/kinds/RGA";
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { Time } from "@nn/time";
import { describe, expect, it, vi } from "vitest";

import { SyncEngine } from "./SyncEngine";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const transportMock = (entries: Record<string, unknown> = {}) => ({
	open: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
	pull: vi.fn<(name: string) => Promise<unknown>>().mockImplementation(async (name) => entries[name]),
	push: vi.fn<(name: string, entry: Encoded) => Promise<void>>().mockResolvedValue(undefined),
	close: vi.fn<() => void>(),
});

type Transport = ReturnType<typeof transportMock>;

class TestEngine extends SyncEngine {
	constructor(
		store: Store,
		private readonly transport: Transport,
	) {
		super(store);
		this.attach();
	}

	public deliver(entries: Record<string, unknown>): void {
		this.receive(entries);
	}

	protected open(): Promise<void> {
		return this.transport.open();
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

const attach = async (transport: Transport) => {
	const store = new Store(schema);
	const sync = new TestEngine(store, transport);

	await flush();

	return { store, sync };
};

const register = (value: string) => new LWWRegister(value, "language", Time.now()).encode();

describe("SyncEngine", () => {
	it("waits for the transport to open before pushing store changes", async () => {
		let finishOpening: (() => void) | undefined;
		const opening = new Promise<void>((resolve) => {
			finishOpening = resolve;
		});
		const transport = transportMock();

		transport.open.mockReturnValue(opening);

		const { store, sync } = await attach(transport);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.pull).not.toHaveBeenCalled();

		finishOpening?.();
		await flush();

		store.state.update((draft) => {
			draft.language = "en";
		});

		expect(transport.push).toHaveBeenCalledExactlyOnceWith(
			"language",
			expect.objectContaining({ key: "language", data: "en" }),
		);
		sync.detach();
	});

	it("opens the transport and restores each field by name", async () => {
		const transport = transportMock({ language: register("cs") });
		const { store } = await attach(transport);

		expect(transport.open).toHaveBeenCalledOnce();
		expect(transport.pull.mock.calls).toStrictEqual([["tickets"], ["language"]]);
		expect(store.state.read().language).toBe("cs");
	});

	it("keeps defaults for fields without a stored entry", async () => {
		const transport = transportMock();
		const { store } = await attach(transport);

		expect(store.state.read()).toStrictEqual({ tickets: [], language: "" });
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("pushes each changed field under its name", async () => {
		const transport = transportMock();
		const { store } = await attach(transport);

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

	it("notifies the delegate when a push fails", async () => {
		const transport = transportMock();
		const error = new Error("write failed");

		transport.push.mockRejectedValue(error);

		const { store, sync } = await attach(transport);
		const delegate = { syncEngineDidFailToPush: vi.fn() };

		sync.delegate = delegate;
		store.state.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(delegate.syncEngineDidFailToPush).toHaveBeenCalledExactlyOnceWith(sync, error);
		expect(transport.close).not.toHaveBeenCalled();
	});

	it("detaches without pulling when opening fails", async () => {
		const transport = transportMock();

		transport.open.mockRejectedValue(new Error("blocked"));

		const { store } = await attach(transport);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.pull).not.toHaveBeenCalled();
		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("detaches when a pull fails", async () => {
		const transport = transportMock();

		transport.pull.mockRejectedValue(new Error("read failed"));

		const { store } = await attach(transport);

		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("stops pushing and closes the transport on detach", async () => {
		const transport = transportMock();
		const { store, sync } = await attach(transport);

		sync.detach();
		store.state.update((draft) => {
			draft.language = "cs";
		});

		expect(transport.push).not.toHaveBeenCalled();
		expect(transport.close).toHaveBeenCalledOnce();
	});

	it("merges received entries into the store", async () => {
		const { store, sync } = await attach(transportMock());

		sync.deliver({ tickets: new RGA([], "tickets").encode(), language: register("cs") });

		expect(store.state.read().language).toBe("cs");
	});

	it("merges only the received fields", async () => {
		const { store, sync } = await attach(transportMock());

		store.state.update((draft) => {
			draft.tickets.push({ title: "First" });
		});
		sync.deliver({ language: register("cs") });

		expect(store.state.read()).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
	});

	it("throws on a received entry that cannot be decoded", async () => {
		const { store, sync } = await attach(transportMock());

		expect(() => sync.deliver({ tickets: {}, language: {} })).toThrow("Invalid encoded entity.");
		expect(store.state.read().language).toBe("");
	});
});
