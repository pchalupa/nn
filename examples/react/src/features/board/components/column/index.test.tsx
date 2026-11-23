import { Theme } from "@radix-ui/themes";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import type { Status } from "example-schema";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import type { BoardSearch } from "@/features/board/board-search";
import { i18n } from "@/i18n";
import { store } from "@/store";

import { Column } from ".";

describe("Column", () => {
	const setup = async (title: string, status: Status, search: BoardSearch = {}) => {
		const routeTree = createRootRoute({
			component: () => <Column title={title} status={status} search={search} />,
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

	it("shows only tickets matching the label filter", async () => {
		store.mutate((data) => {
			data.tickets.push(
				{
					id: "labelled",
					title: "Labelled",
					description: "",
					status: "in-progress",
					assignee: "",
					labels: ["bug"],
					comments: [],
				},
				{
					id: "plain",
					title: "Plain",
					description: "",
					status: "in-progress",
					assignee: "",
					labels: [],
					comments: [],
				},
			);
		});

		const { list } = await setup("In progress", "in-progress", { label: "bug" });

		expect(within(list).getAllByRole("listitem")).toHaveLength(1);
		expect(within(list).getByRole("link", { name: /^Labelled.* bug 0 comments Unassigned$/ })).toBeTruthy();
	});

	it("renders one badge for a repeated label", async () => {
		store.mutate((data) => {
			data.tickets.push({
				id: "repeated",
				title: "Repeated",
				description: "",
				status: "done",
				assignee: "",
				labels: ["bug", "bug"],
				comments: [],
			});
		});

		const { list } = await setup("Done", "done");

		expect(within(list).getAllByText("bug")).toHaveLength(1);
	});
});
