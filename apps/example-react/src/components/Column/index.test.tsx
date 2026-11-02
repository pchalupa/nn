import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { describe, expect, it } from "vitest";

import { Column } from ".";

describe("Column", () => {
	const user = userEvent.setup();

	const setup = () => {
		const title = "Test";
		const status = "todo";

		const routeTree = createRootRoute({ component: () => <Column title={title} status={status} /> });
		const router = createRouter({ routeTree, history: createMemoryHistory() });

		render(
			<Suspense fallback={"fallback"}>
				<RouterProvider router={router} />
			</Suspense>,
		);

		return { title, status };
	};

	it("renders without issues", async () => {
		const { title } = await act(async () => setup());

		expect(await screen.findByText(title)).toBeTruthy();
		expect(screen.getByRole("button")).toBeTruthy();
	});

	it("adds a ticket", async () => {
		await act(async () => setup());
		const button = await screen.findByRole("button");
		// The store is a module singleton shared across this file, so count against what is already there.

		await act(() => user.click(button));

		expect(screen.getByText("todo")).toBeTruthy();
	});
});
