import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BroadcastSync } from "./BroadcastSync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

const engines: BroadcastSync[] = [];

const attach = async (name: string) => {
	const store = new Store(schema);
	const sync = await BroadcastSync.attach(store, name);

	engines.push(sync);

	return { store, sync };
};

describe("BroadcastSync", () => {
	afterEach(() => {
		for (const engine of engines.splice(0)) engine.detach();
	});

	it("shares changes with stores on the same channel", async () => {
		const name = crypto.randomUUID();
		const first = await attach(name);
		const second = await attach(name);

		first.store.state.update((draft) => {
			draft.language = "cs";
			draft.tickets.push({ title: "First" });
		});

		await vi.waitFor(() => {
			expect(second.store.state.read()).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
		});
	});

	it("keeps stores on other channels apart", async () => {
		const first = await attach(crypto.randomUUID());
		const second = await attach(crypto.randomUUID());

		first.store.state.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(second.store.state.read().language).toBe("");
	});

	it("settles concurrent edits on the latest one", async () => {
		const name = crypto.randomUUID();
		const first = await attach(name);
		const second = await attach(name);

		first.store.state.update((draft) => {
			draft.language = "cs";
		});
		second.store.state.update((draft) => {
			draft.language = "en";
		});

		await vi.waitFor(() => {
			expect(first.store.state.read().language).toBe("en");
			expect(second.store.state.read().language).toBe("en");
		});
	});

	it("stops sharing changes on detach", async () => {
		const name = crypto.randomUUID();
		const first = await attach(name);
		const second = await attach(name);

		second.sync.detach();
		first.store.state.update((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(second.store.state.read().language).toBe("");
	});

	it("ignores messages it does not recognize", async () => {
		const name = crypto.randomUUID();
		const { store } = await attach(name);
		const channel = new BroadcastChannel(name);

		for (const message of ["hello", { type: "unknown" }, { type: "entries", entries: null }]) {
			// oxlint-disable-next-line unicorn/require-post-message-target-origin broadcast channels take no target origin
			channel.postMessage(message);
		}

		await flush();
		channel.close();

		expect(store.state.read()).toStrictEqual({ tickets: [], language: "" });
	});
});
