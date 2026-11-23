import { Theme } from "@radix-ui/themes";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { validateBoardSearch } from "@/features/board/board-search";
import { i18n } from "@/i18n";

import { Sidebar } from ".";

describe("Sidebar", () => {
	const setup = () => {
		const routeTree = createRootRoute({ component: Sidebar });
		const router = createRouter({ routeTree, history: createMemoryHistory() });

		render(
			<I18nextProvider i18n={i18n}>
				<Theme>
					<Suspense fallback="fallback">
						<RouterProvider router={router} />
					</Suspense>
				</Theme>
			</I18nextProvider>,
		);
	};

	it("marks only the active filter as the current page", async () => {
		const root = createRootRoute();
		const app = createRoute({ getParentRoute: () => root, id: "_app", component: Sidebar });
		const board = createRoute({
			getParentRoute: () => app,
			id: "_board",
			validateSearch: validateBoardSearch,
			component: Outlet,
		});
		const index = createRoute({ getParentRoute: () => board, path: "/" });
		const router = createRouter({
			routeTree: root.addChildren([app.addChildren([board.addChildren([index])])]),
			history: createMemoryHistory({ initialEntries: ["/?assignee=me"] }),
		});

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<RouterProvider router={router} />
					</Theme>
				</I18nextProvider>,
			),
		);

		const navigation = await screen.findByRole("navigation", { name: "Navigation" });
		const current = within(navigation).getAllByRole("link", { current: "page" });

		expect(current.map((link) => link.textContent)).toStrictEqual(["Assigned to me0"]);
	});

	it("renders a fallback for an unknown user", async () => {
		await act(async () => setup());

		expect(await screen.findByRole("link", { name: "Unknown user" })).toBeTruthy();
	});
});
