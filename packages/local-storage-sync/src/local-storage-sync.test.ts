import { array, object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalStorageSync } from "./local-storage-sync";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const engines: LocalStorageSync[] = [];

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

const connect = async (name?: string) => {
	const store = new Store(schema);
	const sync = new LocalStorageSync(store, name);
	const onError = vi.fn();

	engines.push(sync);
	sync.onError(onError);
	sync.connect();

	await vi.waitFor(() => {
		expect(sync.connected).toBe(true);
	});

	return { store, sync, onError };
};

const encodedLanguage = (language: string) => {
	const store = new Store(schema);

	store.mutate((draft) => {
		draft.language = language;
	});

	return JSON.stringify(store.encode().data.language);
};

const writeFromAnotherTab = (key: string | null, newValue: string | null) => {
	if (key !== null && newValue !== null) localStorage.setItem(key, newValue);

	if (key !== null && newValue === null) localStorage.removeItem(key);

	if (key === null) localStorage.clear();

	dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea: localStorage }));
};

const stored = (key: string): unknown => {
	const value = localStorage.getItem(key);

	if (value === null) return undefined;

	return JSON.parse(value);
};

describe("LocalStorageSync", () => {
	afterEach(() => {
		for (const engine of engines.splice(0)) engine.dispose();

		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("persists existing edits only after an explicitly constructed engine connects", async () => {
		const store = new Store(schema);
		const setItem = vi.spyOn(Storage.prototype, "setItem");
		const sync = new LocalStorageSync(store);

		engines.push(sync);
		store.mutate((draft) => {
			draft.language = "cs";
		});
		await flush();

		expect(sync.idle).toBe(true);
		expect(setItem).not.toHaveBeenCalled();

		sync.connect();

		await vi.waitFor(() => {
			expect(stored("goodstate-default:language")).toMatchObject({ data: "cs" });
		});
	});

	it("stores each field under the default name", async () => {
		await connect();

		await vi.waitFor(() => {
			expect(stored("goodstate-default:language")).toMatchObject({ key: "language" });
		});
		expect(stored("goodstate-default:tickets")).toMatchObject({ key: "tickets" });
	});

	it("stores each field under the given name", async () => {
		await connect("todos");

		await vi.waitFor(() => {
			expect(stored("todos:language")).toMatchObject({ key: "language" });
		});
		expect(stored("goodstate-default:language")).toBeUndefined();
	});

	it("restores each stored field on connect", async () => {
		localStorage.setItem("todos:language", encodedLanguage("cs"));

		const { store } = await connect("todos");

		expect(store.query((state) => state).language).toBe("cs");
	});

	it("stores each field that changes after connecting", async () => {
		const { store } = await connect();

		store.mutate((draft) => {
			draft.tickets.push({ title: "First" });
		});

		await vi.waitFor(() => {
			expect(stored("goodstate-default:tickets")).toMatchObject({ key: "tickets" });
		});

		const restored = new Store(schema);

		restored.merge("tickets", stored("goodstate-default:tickets"));

		expect(restored.query((state) => state).tickets).toStrictEqual([{ title: "First" }]);
	});

	it("merges a field another tab writes", async () => {
		const { store } = await connect();

		writeFromAnotherTab("goodstate-default:language", encodedLanguage("cs"));

		expect(store.query((state) => state).language).toBe("cs");
	});

	it("ignores a write to a property outside the schema", async () => {
		const { store, onError } = await connect();

		writeFromAnotherTab("goodstate-default:theme", encodedLanguage("cs"));

		expect(store.query((state) => state).language).toBe("");
		expect(onError).not.toHaveBeenCalled();
	});

	it.each([
		["removes the key", "goodstate-default:language"],
		["clears the storage", null],
	])("keeps its state and writes it back when another tab %s", async (_reason, key) => {
		const { store, sync, onError } = await connect();

		writeFromAnotherTab("goodstate-default:language", encodedLanguage("cs"));
		writeFromAnotherTab(key, null);

		expect(store.query((state) => state).language).toBe("cs");
		expect(sync.connected).toBe(true);
		expect(onError).not.toHaveBeenCalled();

		store.mutate((draft) => {
			draft.language = "en";
		});

		await vi.waitFor(() => {
			expect(stored("goodstate-default:language")).toMatchObject({ data: "en" });
		});
	});

	it.each([
		["isn't JSON", "{", SyntaxError],
		["isn't an encoded entity", "{}", TypeError],
	])("reports a write from another tab that %s and stays connected", async (_reason, value, errorType) => {
		const { store, sync, onError } = await connect();

		writeFromAnotherTab("goodstate-default:language", value);

		expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(errorType));
		expect(sync.connected).toBe(true);
		expect(store.query((state) => state).language).toBe("");
	});

	it("reports a write that exceeds the quota and stays connected", async () => {
		const { store, sync, onError } = await connect();
		const quotaExceeded = new DOMException("The quota has been exceeded.", "QuotaExceededError");

		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw quotaExceeded;
		});
		store.mutate((draft) => {
			draft.language = "cs";
		});

		await vi.waitFor(() => {
			expect(onError).toHaveBeenCalledExactlyOnceWith(quotaExceeded);
		});
		expect(sync.connected).toBe(true);
	});

	it("reports a failed connection when localStorage is unavailable", async () => {
		const denied = new DOMException("Access is denied.", "SecurityError");

		vi.spyOn(globalThis, "localStorage", "get").mockImplementation(() => {
			throw denied;
		});

		const sync = new LocalStorageSync(new Store(schema));
		const onError = vi.fn();

		engines.push(sync);
		sync.onError(onError);
		sync.connect();

		await vi.waitFor(() => {
			expect(sync.disconnected).toBe(true);
		});
		expect(onError).toHaveBeenCalledExactlyOnceWith(denied);
	});

	it("reports a failed connection when a stored field is corrupt", async () => {
		localStorage.setItem("goodstate-default:language", "{");

		const sync = new LocalStorageSync(new Store(schema));
		const onError = vi.fn();

		engines.push(sync);
		sync.onError(onError);
		sync.connect();

		await vi.waitFor(() => {
			expect(sync.disconnected).toBe(true);
		});
		expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(SyntaxError));
	});

	it("stops merging writes from other tabs on dispose", async () => {
		const { store, sync } = await connect();

		sync.dispose();
		writeFromAnotherTab("goodstate-default:language", encodedLanguage("cs"));

		expect(store.query((state) => state).language).toBe("");
	});

	it("converges with another tab after concurrent edits without writing back and forth", async () => {
		const setItem = Storage.prototype.setItem;
		const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
			const oldValue = this.getItem(key);

			setItem.call(this, key, value);

			if (oldValue !== value) {
				setTimeout(() => dispatchEvent(new StorageEvent("storage", { key, newValue: value, storageArea: this })));
			}
		});
		const first = await connect();
		const second = await connect();

		first.store.mutate((draft) => {
			draft.language = "cs";
		});
		second.store.mutate((draft) => {
			draft.tickets.push({ title: "First" });
		});

		await vi.waitFor(() => {
			expect(first.store.query((state) => state)).toStrictEqual(second.store.query((state) => state));
			expect(first.store.query((state) => state)).toStrictEqual({ tickets: [{ title: "First" }], language: "cs" });
		});

		const writes = write.mock.calls.length;

		await flush();

		expect(write.mock.calls).toHaveLength(writes);
	});
});
