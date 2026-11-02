import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TicketModal } from ".";
import { i18n } from "../../i18n";
import { useRead } from "../../store";

const Titles = () => {
	const titles = useRead((data) => data.tickets.map((ticket) => ticket.title));

	return <output aria-label="titles">{titles.join(",")}</output>;
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

	const setup = async () => {
		const onClose = vi.fn();

		await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Suspense fallback="fallback">
						<TicketModal onClose={onClose} />
						<Titles />
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
