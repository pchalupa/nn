import { DndContext } from "@dnd-kit/core";
import { Theme } from "@radix-ui/themes";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import type { Status, Ticket } from "example-schema";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { i18n } from "@/i18n";

import { Column } from ".";

const ticket = (id: string, title: string): Ticket => ({
	id,
	title,
	description: "",
	status: "in-progress",
	assignee: "",
	labels: [],
	comments: [],
	links: [],
});

describe("Column", () => {
	const setup = async (title: string, status: Status, tickets: Ticket[] = []) => {
		const routeTree = createRootRoute({
			component: () => (
				<DndContext>
					<Column title={title} status={status} tickets={tickets} />
				</DndContext>
			),
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

		const column = await screen.findByRole("region", { name: title });

		return { column, list: within(column).getByRole("list") };
	};

	it("renders the column header", async () => {
		const { list } = await setup("To do", "todo");

		expect(screen.getByRole("region", { name: "To do" })).toBeTruthy();
		expect(screen.getByText("To do")).toBeTruthy();
		expect(screen.getByText("0")).toBeTruthy();
		expect(within(list).queryAllByRole("listitem")).toHaveLength(0);
	});

	it("renders a draggable card per ticket in the given order", async () => {
		const { list } = await setup("In progress", "in-progress", [ticket("a", "First"), ticket("b", "Second")]);
		const links = within(list).getAllByRole("link");

		expect(within(list).getAllByRole("listitem")).toHaveLength(2);
		expect(links.map((link) => link.textContent)).toStrictEqual([
			expect.stringMatching(/^First/),
			expect.stringMatching(/^Second/),
		]);
		expect(links.every((link) => link.getAttribute("aria-describedby")?.startsWith("DndDescribedBy"))).toBe(true);
		expect(links.every((link) => link.getAttribute("draggable") === "false")).toBe(true);
	});
});
