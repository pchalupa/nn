import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BroadcastSync } from "./broadcast-sync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

const engines: BroadcastSync[] = [];

const connect = (name?: string) => {
	const store = new Store(schema);
	const sync = new BroadcastSync(store, name);

	engines.push(sync);
	sync.connect();

	return { store, sync };
};

describe("BroadcastSync", () => {
	afterEach(() => {
		for (const engine of engines.splice(0)) engine.dispose();

		vi.restoreAllMocks();
	});

	it("shares existing edits only after an explicitly constructed engine connects", async () => {
		const name = crypto.randomUUID();
		const first = connect(name);
		const store = new Store(schema);
		const channel = vi.spyOn(globalThis, "BroadcastChannel");
		const sync = new BroadcastSync(store, name);

		engines.push(sync);
		store.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(sync.idle).toBe(true);
		expect(channel).not.toHaveBeenCalled();
		expect(first.store.read().language).toBe("");

		sync.connect();

		await vi.waitFor(() => {
			expect(first.store.read().language).toBe("cs");
		});
	});

	it("shares changes with stores on the same channel", async () => {
		const name = crypto.randomUUID();
		const first = connect(name);
		const second = connect(name);

		first.store.update((draft) => {
			draft.language = "cs";
			draft.tickets.push({ title: "First" });
		});

		await vi.waitFor(() => {
			expect(second.store.read()).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
		});
	});

	it("uses the default channel when no name is given", async () => {
		const first = connect();
		const second = connect("nn-default");

		first.store.update((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(() => {
			expect(second.store.read().language).toBe("cs");
		});
	});

	it("shares a newly connected store's fields with stores already on the channel", async () => {
		const name = crypto.randomUUID();
		const first = connect(name);
		const second = new Store(schema);

		second.update((draft) => {
			draft.language = "cs";
		});

		const sync = new BroadcastSync(second, name);

		engines.push(sync);
		sync.connect();

		await vi.waitFor(() => {
			expect(first.store.read().language).toBe("cs");
		});
	});

	it("keeps stores on other channels apart", async () => {
		const first = connect(crypto.randomUUID());
		const second = connect(crypto.randomUUID());

		first.store.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(second.store.read().language).toBe("");
	});

	it("settles concurrent edits on the latest one", async () => {
		const name = crypto.randomUUID();
		const first = connect(name);
		const second = connect(name);

		first.store.update((draft) => {
			draft.language = "cs";
		});
		second.store.update((draft) => {
			draft.language = "en";
		});

		await vi.waitFor(() => {
			expect(first.store.read().language).toBe("en");
			expect(second.store.read().language).toBe("en");
		});
	});

	it("stops sharing changes on dispose", async () => {
		const name = crypto.randomUUID();
		const first = connect(name);
		const second = connect(name);

		second.sync.dispose();
		first.store.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(second.store.read().language).toBe("");
	});

	it("ignores messages it does not recognize", async () => {
		const name = crypto.randomUUID();
		const { store } = connect(name);
		const channel = new BroadcastChannel(name);

		for (const message of ["hello", { type: "unknown" }, { type: "entries", entries: null }]) {
			// oxlint-disable-next-line unicorn/require-post-message-target-origin broadcast channels take no target origin
			channel.postMessage(message);
		}

		await flush();
		channel.close();

		expect(store.read()).toStrictEqual({ tickets: [], language: "" });
	});
});
