import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalStorage, type LocalStorageDelegate } from "./local-storage";

const entry = { key: "language", data: "cs", metadata: { kind: "register" } };

const delegateMock = () => ({
	localStorageDidChange: vi.fn<LocalStorageDelegate["localStorageDidChange"]>(),
	localStorageDidFail: vi.fn<LocalStorageDelegate["localStorageDidFail"]>(),
});

const writeFromAnotherTab = (key: string | null, newValue: string | null, storageArea: Storage = localStorage) => {
	dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea }));
};

const controllers: AbortController[] = [];

const listening = (name?: string) => {
	const storage = new LocalStorage(name);
	const delegate = delegateMock();
	const controller = new AbortController();

	storage.delegate = delegate;
	storage.listen(controller.signal);
	controllers.push(controller);

	return { storage, delegate, controller };
};

describe("LocalStorage", () => {
	afterEach(() => {
		for (const controller of controllers.splice(0)) controller.abort();

		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("stores, reads back and overwrites an entry as JSON under its name", () => {
		const storage = new LocalStorage("todos");

		storage.set("language", entry);

		expect(localStorage.getItem("todos:language")).toBe(JSON.stringify(entry));
		expect(storage.get("language")).toStrictEqual(entry);

		storage.set("language", { ...entry, data: "en" });

		expect(storage.get("language")).toStrictEqual({ ...entry, data: "en" });
	});

	it("uses the default name when none is given", () => {
		new LocalStorage().set("language", entry);

		expect(localStorage.getItem("goodstate-default:language")).toBe(JSON.stringify(entry));
	});

	it("reads nothing for a missing entry", () => {
		expect(new LocalStorage().get("language")).toBeUndefined();
	});

	it("throws on an entry that isn't JSON", () => {
		localStorage.setItem("goodstate-default:language", "{");

		expect(() => new LocalStorage().get("language")).toThrow(SyntaxError);
	});

	it("tells its delegate about an entry another tab writes under its name", () => {
		const { delegate } = listening("todos");

		writeFromAnotherTab("todos:language", JSON.stringify(entry));

		expect(delegate.localStorageDidChange).toHaveBeenCalledExactlyOnceWith("language", entry);
		expect(delegate.localStorageDidFail).not.toHaveBeenCalled();
	});

	it.each([
		["session storage", "todos:language", JSON.stringify(entry), () => sessionStorage],
		["another name", "tasks:language", JSON.stringify(entry), () => localStorage],
		["a removed key", "todos:language", null, () => localStorage],
		["a cleared storage", null, null, () => localStorage],
	])("ignores %s", (_reason, key, newValue, storageArea) => {
		const { delegate } = listening("todos");

		writeFromAnotherTab(key, newValue, storageArea());

		expect(delegate.localStorageDidChange).not.toHaveBeenCalled();
		expect(delegate.localStorageDidFail).not.toHaveBeenCalled();
	});

	it("tells its delegate about an entry that isn't JSON", () => {
		const { delegate } = listening();

		writeFromAnotherTab("goodstate-default:language", "{");

		expect(delegate.localStorageDidFail).toHaveBeenCalledExactlyOnceWith(expect.any(SyntaxError));
		expect(delegate.localStorageDidChange).not.toHaveBeenCalled();
	});

	it("stops listening when the signal aborts", () => {
		const { delegate, controller } = listening();

		controller.abort();
		writeFromAnotherTab("goodstate-default:language", JSON.stringify(entry));

		expect(delegate.localStorageDidChange).not.toHaveBeenCalled();
	});
});
