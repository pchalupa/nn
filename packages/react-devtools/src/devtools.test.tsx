import { object, string } from "@goodstate/schema";
import { Store } from "@goodstate/store";
import { fireEvent, render, within } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";

import Devtools from "./devtools";

describe("Devtools", () => {
	const schema = object({ language: string() });

	const devtools = () => {
		const container = document.querySelector("[data-goodstate-devtools]")?.shadowRoot?.querySelector("[data-devtools]");

		if (!(container instanceof HTMLElement)) throw new TypeError("Devtools are not rendered");

		return within(container);
	};

	it("starts closed with a labelled button that opens the store panel", () => {
		render(<Devtools store={new Store(schema)} />);

		expect(devtools().queryByRole("tree")).toBeNull();
		expect(devtools().getByRole("button", { name: "Open Goodstate DevTools" }).textContent).toBe("DevTools");

		fireEvent.click(devtools().getByRole("button", { name: "Open Goodstate DevTools" }));

		expect(devtools().getByRole("complementary", { name: "Goodstate DevTools" })).toBeDefined();
		expect(devtools().getByRole("tree")).toBeDefined();
	});

	it("closes from the close button", () => {
		render(<Devtools store={new Store(schema)} />);
		fireEvent.click(devtools().getByRole("button", { name: "Open Goodstate DevTools" }));
		fireEvent.click(devtools().getByRole("button", { name: "Close" }));

		expect(devtools().queryByRole("tree")).toBeNull();
		expect(devtools().getByRole("button", { name: "Open Goodstate DevTools" })).toBeDefined();
	});

	it("opens the devtools in strict mode", () => {
		render(
			<StrictMode>
				<Devtools store={new Store(schema)} />
			</StrictMode>,
		);

		fireEvent.click(devtools().getByRole("button", { name: "Open Goodstate DevTools" }));

		expect(devtools().getByRole("tree")).toBeDefined();
	});
});
