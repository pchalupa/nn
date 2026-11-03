import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, Suspense, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TicketModal } from ".";
import { i18n } from "../../i18n";
import { useRead, useUpdate } from "../../store";

const Titles = () => {
	const titles = useRead((data) => data.tickets.map((ticket) => ticket.title));

	return <output aria-label="titles">{titles.join(",")}</output>;
};

const Assignees = () => {
	const assignees = useRead((data) => data.tickets.map((ticket) => ticket.assignee));

	return <output aria-label="assignees">{assignees.join(",")}</output>;
};

const AddUser = () => {
	const updateStore = useUpdate();

	useEffect(() => {
		updateStore((data) => {
			data.users.push({ id: "ann", name: "Ann", passkeys: [] });
		});
	}, [updateStore]);

	return null;
};

describe("TicketModal", () => {
	const user = userEvent.setup();

	beforeAll(() => {
		HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
			this.open = true;
		};
		HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
			this.open = false;
			this.dispatchEvent(new Event("close"));
		};
	});

	const setup = async (children?: ReactNode) => {
		const onClose = vi.fn();

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Suspense fallback="fallback">
						<TicketModal onClose={onClose} />
						<Titles />
						{children}
					</Suspense>
				</I18nextProvider>,
			),
		);

		return { onClose, dialog: await screen.findByRole("dialog") };
	};

	it("opens with an empty form", async () => {
		const { dialog } = await setup();

		expect(dialog).toHaveProperty("open", true);
		expect(screen.getByRole("textbox", { name: "Title" })).toHaveProperty("value", "");
		expect(screen.getByRole("combobox", { name: "Status" })).toHaveProperty("value", "todo");
		expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveProperty("value", "");
	});

	it("assigns a user from the dropdown", async () => {
		await setup(
			<>
				<AddUser />
				<Assignees />
			</>,
		);

		await user.type(screen.getByRole("textbox", { name: "Title" }), "Assigned");
		await screen.findByRole("option", { name: "Ann" });
		await user.selectOptions(screen.getByRole("combobox", { name: "Assignee" }), "Ann");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "assignees" }).textContent).toContain("ann");
	});

	it("creates a ticket and closes on save", async () => {
		const { onClose } = await setup();

		await user.type(screen.getByRole("textbox", { name: "Title" }), "  Created  ");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "titles" }).textContent).toContain("Created");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("does not create a ticket without a title", async () => {
		const { onClose, dialog } = await setup();
		const before = screen.getByRole("status", { name: "titles" }).textContent;

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("status", { name: "titles" }).textContent).toBe(before);
		expect(dialog).toHaveProperty("open", true);
		expect(onClose).not.toHaveBeenCalled();
	});
});
