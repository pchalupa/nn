import { object, string } from "@nn/schema";
import { Store } from "@nn/store";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Devtools } from "./index";

const schema = object({ language: string() });

describe("Devtools", () => {
	it("renders nothing outside development", async () => {
		render(<Devtools store={new Store(schema)} />);
		await act(() => import("./devtools"));

		expect(document.querySelector("[data-nn-devtools]")).toBeNull();
	});

	it("renders the devtools in development", async () => {
		vi.stubEnv("NODE_ENV", "development");
		render(<Devtools store={new Store(schema)} />);

		await waitFor(() => expect(document.querySelector("[data-nn-devtools]")).not.toBeNull());
	});

	it("renders the devtools under browser automation", async () => {
		vi.stubGlobal("navigator", { webdriver: true });
		render(<Devtools store={new Store(schema)} />);

		await waitFor(() => expect(document.querySelector("[data-nn-devtools]")).not.toBeNull());
	});
});
