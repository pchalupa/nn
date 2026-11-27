import { createStore } from "@goodstate/react";
import { Theme } from "@radix-ui/themes";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { schema, type Ticket } from "example-schema";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { i18n } from "@/i18n";
import { store, useQuery } from "@/store";

import { TicketModal } from ".";

const Labels = () => {
	const labels = useQuery((data) => data.boards[0]?.tickets[0]?.labels.join("|") ?? "");

	return <output aria-label="labels">{labels}</output>;
};

const commented: Ticket = {
	id: "commented",
	title: "Commented",
	description: "",
	status: "todo",
	priority: "low",
	assignee: "",
	labels: [],
	comments: [],
	links: [],
};

describe("TicketModal", () => {
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
			data.boards = [{ id: "goodstate", name: "Goodstate", description: "", tickets: [structuredClone(commented)] }];
			data.users = [];
		});
	});

	it("keeps a label added remotely while adding another", async () => {
		const remote = createStore(schema);

		remote.store.merge("boards", store.encode().data.boards);
		remote.store.mutate((data) => {
			data.boards[0]?.tickets.find((entry) => entry.id === "commented")?.labels.push("docs");
		});

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Suspense fallback="fallback">
							<TicketModal boardId="goodstate" id="commented" />
							<Labels />
						</Suspense>
					</Theme>
				</I18nextProvider>,
			),
		);

		await user.type(await screen.findByRole("textbox", { name: "Labels" }), "bug{Enter}");
		await act(async () => store.merge("boards", remote.store.encode().data.boards));

		expect(
			screen.getByRole("status", { name: "labels", hidden: true }).textContent?.split("|").toSorted(),
		).toStrictEqual(["bug", "docs"]);
		expect(screen.getByRole("button", { name: "Remove docs" })).toBeDefined();
	});
});
