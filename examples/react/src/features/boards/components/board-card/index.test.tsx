import { createStore } from "@goodstate/react";
import { Theme } from "@radix-ui/themes";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { schema, type Ticket } from "example-schema";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n";
import { store } from "@/store";

import { BoardCard } from ".";

const ticket = (id: string, status: Ticket["status"]): Ticket => ({
	id,
	title: id,
	description: "",
	status,
	priority: "low",
	assignee: "",
	labels: [],
	comments: [],
	links: [],
});

const goodstate = { id: "b1", name: "Goodstate", description: "Sync engine and the example app." };

const other = { id: "b2", name: "Other", description: "" };

describe("BoardCard", () => {
	const user = userEvent.setup();

	beforeAll(() => {
		Element.prototype.hasPointerCapture = () => false;
		Element.prototype.scrollIntoView = () => {};
		globalThis.ResizeObserver = class {
			public observe() {}

			public unobserve() {}

			public disconnect() {}
		};
	});

	beforeEach(() => {
		store.mutate((data) => {
			data.boards = [
				{
					...goodstate,
					tickets: [ticket("t1", "todo"), ticket("t2", "done"), ticket("t3", "done"), ticket("t4", "in-progress")],
				},
				{ ...other, tickets: [ticket("t5", "todo")] },
			];
		});
	});

	const setup = async () => {
		const root = createRootRoute({ component: () => <BoardCard board={goodstate} /> });
		const boardRoute = createRoute({ getParentRoute: () => root, path: "boards/$boardId" });
		const router = createRouter({
			routeTree: root.addChildren([boardRoute]),
			history: createMemoryHistory(),
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
	};

	const openMenu = async () => user.click(await screen.findByRole("button", { name: "Actions for Goodstate" }));

	it("drops a ticket added elsewhere to a board deleted here", async () => {
		const remote = createStore(schema);

		remote.store.merge("boards", store.encode().data.boards);
		remote.store.mutate((data) => {
			data.boards.find((board) => board.id === "b1")?.tickets.push(ticket("late", "todo"));
		});

		await setup();
		await openMenu();
		await user.click(screen.getByRole("menuitem", { name: "Delete" }));
		await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
		await act(async () => store.merge("boards", remote.store.encode().data.boards));

		expect(store.query((data) => data.boards.map(({ id }) => id))).toStrictEqual(["b2"]);
		expect(store.query((data) => data.boards.flatMap((board) => board.tickets.map(({ id }) => id)))).toStrictEqual([
			"t5",
		]);
	});
});
