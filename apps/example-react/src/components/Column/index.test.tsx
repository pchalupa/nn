import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { describe, expect, it } from "vitest";

import { Column } from ".";

describe("Column", () => {
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
		expect(screen.queryByRole("button")).toBeNull();
	});
});
