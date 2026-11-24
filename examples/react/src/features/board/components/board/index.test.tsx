import { Theme } from "@radix-ui/themes";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Ticket } from "example-schema";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";
import { store } from "@/store";

import { Board } from ".";

const ticket = (id: string, title: string, status: Ticket["status"]): Ticket => ({
	id,
	title,
	description: "",
	status,
	priority: "low",
	assignee: "",
	labels: [],
	comments: [],
	links: [],
});

describe("Board", () => {
	const user = userEvent.setup();

	beforeAll(() => {
		globalThis.ResizeObserver = class {
			public observe() {}

			public unobserve() {}

			public disconnect() {}
		};
	});

	beforeEach(() => {
		store.mutate((data) => {
			data.users = [];
			data.tickets = [ticket("a", "Planned", "todo"), ticket("b", "Shipped", "done"), ticket("c", "Released", "done")];
		});
	});

	const setup = async () => {
		const onNewTicket = vi.fn();
		const routeTree = createRootRoute({
			component: () => <Board search={{}} onNewTicket={onNewTicket} />,
		});
		const router = createRouter({ routeTree, history: createMemoryHistory() });

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Suspense fallback="fallback">
							<RouterProvider router={router} />
						</Suspense>
					</Theme>
				</I18nextProvider>,
			),
		);

		return { onNewTicket };
	};

	it("titles the mobile and the desktop header with the board name and ticket count", async () => {
		await setup();

		expect((await screen.findAllByRole("heading", { level: 1 })).map((heading) => heading.textContent)).toStrictEqual([
			"nn",
			"nn",
		]);
		expect(screen.getAllByText("3 tickets")).toHaveLength(2);
	});

	it("renders each status column and each card once", async () => {
		await setup();

		expect((await screen.findAllByRole("region")).map((region) => region.getAttribute("aria-label"))).toStrictEqual([
			"Backlog",
			"To do",
			"In progress",
			"Done",
		]);
		expect(screen.getAllByRole("listitem")).toHaveLength(3);
	});

	it("counts tickets in each column header", async () => {
		await setup();

		expect(within(await screen.findByRole("region", { name: "Done" })).getByText("2")).toBeDefined();
		expect(within(screen.getByRole("region", { name: "To do" })).getByText("1")).toBeDefined();
	});

	it("creates a new backlog ticket from the desktop header and the mobile action bar", async () => {
		const { onNewTicket } = await setup();
		const buttons = await screen.findAllByRole("button", { name: "New ticket" });

		expect(buttons.map((button) => button.textContent)).toStrictEqual(["New", "New"]);

		for (const button of buttons) {
			await user.click(button);
		}

		expect(onNewTicket.mock.calls).toStrictEqual([["backlog"], ["backlog"]]);
	});

	it("opens the drawer from the menu and the Filter button", async () => {
		await setup();

		await user.click(await screen.findByRole("button", { name: "Open menu" }));

		const drawer = await screen.findByRole("dialog", { name: "Menu" });

		expect(within(drawer).getByRole("navigation", { name: "Navigation" })).toBeDefined();

		await user.keyboard("{Escape}");

		expect(screen.queryByRole("dialog")).toBeNull();

		await user.click(screen.getByRole("button", { name: "Filter" }));

		expect(await screen.findByRole("dialog", { name: "Menu" })).toBeDefined();
	});
});
