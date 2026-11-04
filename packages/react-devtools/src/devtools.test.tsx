// @vitest-environment jsdom
import { array, object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Devtools } from "./devtools";

const schema = object({ tickets: array(object({ title: string() })), language: string() });

const open = () => fireEvent.click(screen.getByRole("button", { name: "Open nn devtools" }));

describe("Devtools", () => {
	afterEach(() => {
		cleanup();
	});

	it("starts closed with a button that opens the store panel", () => {
		render(<Devtools store={new Store(schema)} />);

		expect(screen.queryByRole("tree")).toBeNull();

		open();

		expect(screen.getByRole("complementary", { name: "nn devtools" })).toBeDefined();
		expect(screen.getByRole("tree")).toBeDefined();
	});

	it("closes from the close button", () => {
		render(<Devtools store={new Store(schema)} />);
		open();

		fireEvent.click(screen.getByRole("button", { name: "Close" }));

		expect(screen.queryByRole("tree")).toBeNull();
		expect(screen.getByRole("button", { name: "Open nn devtools" })).toBeDefined();
	});

	it("shows an emoji on the button", () => {
		render(<Devtools store={new Store(schema)} />);

		expect(screen.getByRole("button", { name: "Open nn devtools" }).textContent).toBe("⚙️");
	});
});
