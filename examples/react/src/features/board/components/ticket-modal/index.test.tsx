import { Theme } from "@radix-ui/themes";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, Suspense, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TicketModal } from ".";
import { i18n } from "../../i18n";
import { useQuery, useMutation } from "../../store";

const Titles = () => {
	const titles = useQuery((data) => data.tickets.map((ticket) => ticket.title));

	return <output aria-label="titles">{titles.join(",")}</output>;
};

const Assignees = () => {
	const assignees = useQuery((data) => data.tickets.map((ticket) => ticket.assignee));

	return <output aria-label="assignees">{assignees.join(",")}</output>;
};

const AddUser = () => {
	const mutate = useMutation();

	useEffect(() => {
		mutate((data) => {
			data.users.push({ id: "ann", name: "Ann", passkeys: [] });
		});
	}, [mutate]);

	return null;
};

const AddCommentedTicket = () => {
	const mutate = useMutation();

	useEffect(() => {
		mutate((data) => {
			data.tickets.push({
				id: "commented",
				title: "Commented",
				description: "",
				status: "todo",
				assignee: "",
				comments: [{ id: "first", author: "bob", createdAt: "2026-01-01T00:00:00.000Z", body: "Looks good" }],
			});
		});
	}, [mutate]);

	return null;
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

	const setup = async (children?: ReactNode, id?: string) => {
		const onClose = vi.fn();

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Suspense fallback="fallback">
							<TicketModal id={id} onClose={onClose} />
							<Titles />
							{children}
						</Suspense>
					</Theme>
				</I18nextProvider>,
			),
		);

		return { onClose, dialog: await screen.findByRole("dialog") };
	};

	it("opens with an empty form", async () => {
		const { dialog } = await setup();

		expect(dialog).toBeDefined();
		expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "");
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("To Do");
		expect(screen.getByRole("combobox", { name: "Assignee" }).textContent).toBe("Unassigned");
	});

	it("assigns a user from the dropdown", async () => {
		await setup(
			<>
				<AddUser />
				<Assignees />
			</>,
		);

		await user.type(screen.getByRole("textbox", { name: "Title" }), "Assigned");
		await user.click(screen.getByRole("combobox", { name: "Assignee" }));
		await user.click(await screen.findByRole("option", { name: "Ann" }));
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "assignees", hidden: true }).textContent).toContain("ann");
	});

	it("creates a ticket and closes on save", async () => {
		const { onClose } = await setup();

		await user.type(screen.getByRole("textbox", { name: "Title" }), "  Created  ");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "titles", hidden: true }).textContent).toContain("Created");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("does not create a ticket without a title", async () => {
		const { onClose, dialog } = await setup();
		const before = screen.getByRole("status", { name: "titles", hidden: true }).textContent;

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "titles", hidden: true }).textContent).toBe(before);
		expect(dialog.isConnected).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("does not offer deleting a new ticket", async () => {
		await setup();

		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
	});

	it("deletes an existing ticket and closes", async () => {
		const { onClose } = await setup(<AddCommentedTicket />, "commented");

		await user.click(await screen.findByRole("button", { name: "Delete" }));

		expect(screen.getByRole("status", { name: "titles", hidden: true }).textContent).not.toContain("Commented");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("shows comments of an existing ticket", async () => {
		await setup(<AddCommentedTicket />, "commented");

		const comments = await screen.findByRole("region", { name: "Comments" });

		expect(await within(comments).findByText("Looks good")).toBeDefined();
	});
});
