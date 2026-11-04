// @vitest-environment jsdom
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Devtools", () => {
	const schema = object({ tickets: array(object({ title: string() })), language: string() });

	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("renders nothing outside development", async () => {
		const { Devtools } = await import("./index");

		render(<Devtools store={new Store(schema)} />);

		expect(document.body.querySelector("[data-nn-devtools]")).toBeNull();
	});

	it("renders the devtools in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.resetModules();
		const { Devtools } = await import("./index");

		render(<Devtools store={new Store(schema)} />);

		expect(screen.getByRole("button", { name: "Open nn devtools" })).toBeDefined();
	});

	it("renders the devtools under browser automation", async () => {
		Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
		const { Devtools } = await import("./index");

		render(<Devtools store={new Store(schema)} />);

		expect(screen.getByRole("button", { name: "Open nn devtools" })).toBeDefined();

		Reflect.deleteProperty(navigator, "webdriver");
	});
});
