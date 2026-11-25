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
import type { Ticket } from "example-schema";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it } from "vitest";

import { clearSession, setSession } from "@/features/authentication/session";
import { validateBoardSearch } from "@/features/board/board-search";
import { i18n } from "@/i18n";
import { store } from "@/store";

import { Sidebar } from ".";

const ticket = (id: string, assignee: string, labels: string[]): Ticket => ({
	id,
	title: id,
	description: "",
	status: "todo",
	priority: "low",
	assignee,
	labels,
	comments: [],
	links: [],
});

describe("Sidebar", () => {
	beforeEach(() => {
		store.mutate((data) => {
			data.boards = [{ id: "nn", name: "nn", description: "", tickets: [] }];
		});
	});

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
			path: "boards/$boardId",
			validateSearch: validateBoardSearch,
			component: Outlet,
		});
		const index = createRoute({ getParentRoute: () => board, path: "/" });
		const router = createRouter({
			routeTree: root.addChildren([app.addChildren([board.addChildren([index])])]),
			history: createMemoryHistory({ initialEntries: ["/boards/nn?assignee=me"] }),
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

	it("counts and lists only the open board's tickets", async () => {
		setSession("ann");
		store.mutate((data) => {
			data.boards = [
				{ id: "nn", name: "nn", description: "", tickets: [ticket("a", "ann", ["bug"]), ticket("b", "", [])] },
				{
					id: "other",
					name: "Other",
					description: "",
					tickets: [ticket("c", "ann", ["docs"]), ticket("d", "ann", ["docs"])],
				},
			];
		});

		const root = createRootRoute();
		const app = createRoute({ getParentRoute: () => root, id: "_app", component: Sidebar });
		const board = createRoute({
			getParentRoute: () => app,
			path: "boards/$boardId",
			validateSearch: validateBoardSearch,
		});
		const router = createRouter({
			routeTree: root.addChildren([app.addChildren([board])]),
			history: createMemoryHistory({ initialEntries: ["/boards/nn"] }),
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

		expect(
			within(navigation)
				.getAllByRole("link")
				.map((link) => link.textContent),
		).toStrictEqual(["nn2", "Assigned to me1", "bug"]);
		expect(screen.getByRole("link", { name: "Board" }).getAttribute("href")).toBe("/");

		clearSession();
	});

	it("shows board items only inside a board", async () => {
		const root = createRootRoute();
		const app = createRoute({ getParentRoute: () => root, id: "_app", component: Sidebar });
		const profile = createRoute({ getParentRoute: () => app, path: "profile" });
		const router = createRouter({
			routeTree: root.addChildren([app.addChildren([profile])]),
			history: createMemoryHistory({ initialEntries: ["/profile"] }),
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

		expect(within(navigation).queryByRole("link", { name: /Assigned to me/ })).toBeNull();
		expect(within(navigation).queryByRole("link", { name: /^nn/ })).toBeNull();
	});

	it("shows no nav items on the boards list", async () => {
		const root = createRootRoute();
		const app = createRoute({ getParentRoute: () => root, id: "_app", component: Sidebar });
		const index = createRoute({ getParentRoute: () => app, path: "/" });
		const router = createRouter({
			routeTree: root.addChildren([app.addChildren([index])]),
			history: createMemoryHistory({ initialEntries: ["/"] }),
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

		expect(within(navigation).queryAllByRole("link")).toHaveLength(0);
	});

	it("renders a fallback for an unknown user", async () => {
		await act(async () => setup());

		expect(await screen.findByRole("link", { name: "Unknown user" })).toBeTruthy();
	});
});
