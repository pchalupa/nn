import { createStore } from "@nn/react";
import { Theme } from "@radix-ui/themes";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { schema, type Ticket } from "example-schema";
import { createRef, Suspense } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from "@/i18n";
import { store, useQuery } from "@/store";

import { TicketModal, type TicketModalHandle } from ".";
import type { TicketDraft } from "./parts/fields";

const Probes = () => {
	const tickets = useQuery((data) =>
		data.tickets.map((ticket) => ({ title: ticket.title, assignee: ticket.assignee, labels: ticket.labels.join("|") })),
	);

	return (
		<>
			<output aria-label="titles">{tickets.map((ticket) => ticket.title).join(",")}</output>
			<output aria-label="assignees">{tickets.map((ticket) => ticket.assignee).join(",")}</output>
			<output aria-label="labels">{tickets.map((ticket) => ticket.labels).join(",")}</output>
		</>
	);
};

const commented: Ticket = {
	id: "commented",
	title: "Commented",
	description: "",
	status: "todo",
	assignee: "",
	labels: [],
	comments: [{ id: "first", author: "bob", createdAt: "2026-01-01T00:00:00.000Z", body: "Looks good" }],
};

const probe = (name: string) => screen.getByRole("status", { name, hidden: true }).textContent;

const ctrlEnter = "{Control>}{Enter}{/Control}";

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
			data.users = [
				{ id: "ann", name: "Ann", passkeys: [] },
				{ id: "bob", name: "Bob", passkeys: [{ credentialId: "bob", publicKey: "key", algorithm: -7 }] },
			];
			data.tickets = [structuredClone(commented)];
		});
	});

	const renderModal = async (id?: string) => {
		const onClose = vi.fn();
		const modal = createRef<TicketModalHandle>();

		const { unmount } = await act(async () =>
			render(
				<I18nextProvider i18n={i18n}>
					<Theme>
						<Suspense fallback="fallback">
							<TicketModal ref={modal} id={id} onClose={onClose} />
							<Probes />
						</Suspense>
					</Theme>
				</I18nextProvider>,
			),
		);

		const open = (initial?: Partial<TicketDraft>) => act(() => modal.current?.open(initial));

		return { onClose, unmount, open };
	};

	const setup = async (id?: string, initial?: Partial<TicketDraft>) => {
		const { onClose, unmount, open } = await renderModal(id);

		if (id === undefined) await open(initial);

		return { onClose, unmount, open, dialog: await screen.findByRole("dialog") };
	};

	const title = () => screen.getByRole("textbox", { name: "Title" });

	const description = () => screen.getByRole("textbox", { name: "Description" });

	const changeTicket = (change: (ticket: Ticket) => void) =>
		act(async () =>
			store.mutate((data) => {
				const ticket = data.tickets.find((entry) => entry.id === "commented");

				if (ticket) change(ticket);
			}),
		);

	it("opens with an empty form", async () => {
		const { dialog } = await setup();

		expect(dialog).toBeDefined();
		expect(title()).toHaveProperty("value", "");
		expect(document.activeElement).toBe(title());
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("Backlog");
		expect(screen.getByRole("combobox", { name: "Assignee" }).textContent).toBe("Unassigned");
	});

	it("opens a new ticket with the given status", async () => {
		await setup(undefined, { status: "done" });

		expect(title()).toHaveProperty("value", "");
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("Done");
	});

	it("opens an existing ticket with every field editable", async () => {
		await setup("commented");

		const comments = screen.getByRole("region", { name: "Comments" });

		expect(title()).toHaveProperty("value", "Commented");
		expect(description()).toHaveProperty("value", "");
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("To do");
		expect(screen.getByRole("textbox", { name: "Labels" })).toBeDefined();
		expect(within(comments).getByText("Looks good")).toBeDefined();
		expect(within(comments).getByText("Bob")).toBeDefined();
		expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
		expect(screen.getAllByRole("button", { name: "Copy link" })).toHaveLength(2);
	});

	it("saves status as soon as it changes", async () => {
		await setup("commented");

		await user.click(screen.getByRole("combobox", { name: "Status" }));
		await user.click(await screen.findByRole("option", { name: "Done" }));

		expect(store.query((data) => data.tickets[0]?.status)).toBe("done");
		expect(screen.getByRole("combobox", { name: "Status" }).textContent).toBe("Done");
	});

	it("saves the assignee as soon as it changes", async () => {
		await setup("commented");

		await user.click(screen.getByRole("combobox", { name: "Assignee" }));
		await user.click(await screen.findByRole("option", { name: "Ann" }));

		expect(probe("assignees")).toBe("ann");
	});

	it("shows avatars beside the assignee names", async () => {
		await setup("commented");

		const trigger = screen.getByRole("combobox", { name: "Assignee" });

		expect(trigger.textContent).toBe("Unassigned");
		expect(within(trigger).getByText("Unassigned").parentElement?.querySelector("[aria-hidden] svg")).not.toBeNull();

		await user.click(trigger);

		const bob = await screen.findByRole("option", { name: "Bob" });

		expect(await within(bob).findByText("B")).toBeDefined();
		expect(screen.getByRole("option", { name: "Ann" }).querySelector(".rt-AvatarRoot svg")).not.toBeNull();

		await user.click(bob);

		expect(await within(trigger).findByText("B")).toBeDefined();
		expect(trigger.textContent).toBe("BBob");
	});

	it("shows the selected status in medium weight", async () => {
		await setup("commented");

		const trigger = screen.getByRole("combobox", { name: "Status" });

		expect(within(trigger).getByText("To do").classList).toContain("rt-r-weight-medium");
	});

	it("saves the title on blur", async () => {
		await setup("commented");

		await user.clear(title());
		await user.type(title(), "  Renamed  ");

		expect(probe("titles")).toBe("Commented");

		await user.click(description());

		expect(probe("titles")).toBe("Renamed");
		expect(title()).toHaveProperty("value", "Renamed");
	});

	it("does not save a blank title", async () => {
		await setup("commented");

		await user.clear(title());
		await user.type(title(), "   ");
		await user.click(description());

		expect(probe("titles")).toBe("Commented");
		expect(title()).toHaveProperty("value", "Commented");
	});

	it("saves typed text when the modal closes", async () => {
		const { onClose } = await setup("commented");

		await user.type(description(), "Typed");
		await user.keyboard("{Escape}");

		expect(store.query((data) => data.tickets[0]?.description)).toBe("Typed");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("saves typed text when the modal unmounts without closing", async () => {
		const { unmount } = await setup("commented");

		await user.type(description(), "Typed");
		unmount();

		expect(store.query((data) => data.tickets[0]?.description)).toBe("Typed");
	});

	it("does not write again on unmount after a close saved the text", async () => {
		const { unmount } = await setup("commented");
		const mutate = vi.spyOn(store, "mutate");

		await user.type(description(), "Typed");
		await user.keyboard("{Escape}");
		unmount();

		expect(mutate).toHaveBeenCalledOnce();
		mutate.mockRestore();
	});

	it("does not recreate a ticket deleted elsewhere on unmount", async () => {
		const { unmount } = await setup("commented");

		await user.type(description(), "Typed");
		await act(async () =>
			store.mutate((data) => {
				data.tickets = [];
			}),
		);
		unmount();

		expect(store.query((data) => data.tickets)).toStrictEqual([]);
	});

	it("saves a typed title when closed with the Close button", async () => {
		await setup("commented");

		await user.type(title(), "!");
		await user.click(screen.getByRole("button", { name: "Close" }));

		expect(probe("titles")).toBe("Commented!");
	});

	it("follows remote changes after saving a field", async () => {
		await setup("commented");

		await user.type(title(), "!");
		await user.click(description());
		await changeTicket((ticket) => {
			ticket.title = "Remote";
		});

		expect(title()).toHaveProperty("value", "Remote");
	});

	it("adds and removes labels immediately", async () => {
		await setup("commented");

		const input = screen.getByRole("textbox", { name: "Labels" });

		await user.type(input, "bug{Enter}");
		await user.type(input, "docs{Enter}");

		expect(probe("labels")).toBe("bug|docs");

		await user.click(screen.getByRole("button", { name: "Remove bug" }));

		expect(screen.queryByRole("button", { name: "Remove bug" })).toBeNull();
		expect(probe("labels")).toBe("docs");
	});

	it("keeps a label added remotely while adding another", async () => {
		const remote = createStore(schema);

		remote.store.merge("tickets", store.encode().data.tickets);
		remote.store.mutate((data) => {
			data.tickets.find((entry) => entry.id === "commented")?.labels.push("docs");
		});
		await setup("commented");

		await user.type(screen.getByRole("textbox", { name: "Labels" }), "bug{Enter}");
		await act(async () => store.merge("tickets", remote.store.encode().data.tickets));

		expect(probe("labels")?.split("|").toSorted()).toStrictEqual(["bug", "docs"]);
		expect(screen.getByRole("button", { name: "Remove docs" })).toBeDefined();
	});

	it("ignores blank and duplicate labels", async () => {
		await setup("commented");

		const input = screen.getByRole("textbox", { name: "Labels" });

		await user.type(input, "  {Enter}");

		expect(screen.queryAllByRole("button", { name: /^Remove / })).toHaveLength(0);

		await user.type(input, "bug{Enter}");
		await user.type(input, " bug {Enter}");

		expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(1);
		expect(input).toHaveProperty("value", "");
		expect(probe("labels")).toBe("bug");
	});

	it("keeps a typed title when the ticket changes remotely", async () => {
		await setup("commented");

		await user.clear(title());
		await user.type(title(), "Mine");
		await changeTicket((ticket) => {
			ticket.title = "Theirs";
			ticket.description = "Remote";
		});

		expect(title()).toHaveProperty("value", "Mine");
		expect(description()).toHaveProperty("value", "Remote");
	});

	it("creates a new ticket only on Create ticket", async () => {
		const { onClose } = await setup();

		await user.type(title(), "  Created  ");
		await user.click(screen.getByRole("combobox", { name: "Assignee" }));
		await user.click(await screen.findByRole("option", { name: "Ann" }));
		await user.type(screen.getByRole("textbox", { name: "Labels" }), "bug{Enter}");
		await user.click(description());

		expect(probe("titles")).toBe("Commented");

		await user.click(screen.getByRole("button", { name: "Create ticket" }));

		expect(probe("titles")).toBe("Commented,Created");
		expect(probe("assignees")).toBe(",ann");
		expect(store.query((data) => data.tickets[1]?.labels)).toStrictEqual(["bug"]);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("creates a new ticket with Mod+Enter", async () => {
		const { onClose } = await setup();

		await user.type(title(), "Created");
		await user.type(description(), `Body${ctrlEnter}`);

		expect(probe("titles")).toBe("Commented,Created");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("creates a new ticket with Mod+Enter in the labels input", async () => {
		const { onClose } = await setup();

		await user.type(title(), "Created");
		await user.type(screen.getByRole("textbox", { name: "Labels" }), ctrlEnter);

		expect(probe("titles")).toBe("Commented,Created");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("does not create without a title", async () => {
		const { onClose, dialog } = await setup();

		await user.type(title(), "   ");
		await user.click(screen.getByRole("button", { name: "Create ticket" }));

		expect(probe("titles")).toBe("Commented");
		expect(document.activeElement).toBe(title());
		expect(title().getAttribute("aria-invalid")).toBe("true");
		expect(title().getAttribute("aria-describedby")).toBe(screen.getByText("Enter a title.").id);
		expect(dialog.isConnected).toBe(true);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes a new ticket on cancel without creating it", async () => {
		const { onClose } = await setup();

		await user.type(title(), "Discarded");
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(probe("titles")).toBe("Commented");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("shows nothing until opened", async () => {
		await renderModal();

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("reopens a new ticket with an empty draft after cancelling", async () => {
		const { open } = await setup();

		await user.type(title(), "Discarded");
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(screen.queryByRole("dialog")).toBeNull();

		await open();

		expect(title()).toHaveProperty("value", "");
	});

	it("offers neither deleting nor comments for a new ticket", async () => {
		await setup();

		expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
		expect(screen.queryByRole("region", { name: "Comments" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
	});

	it("deletes only after confirming", async () => {
		const { onClose } = await setup("commented");

		await user.click(screen.getByRole("button", { name: "Delete" }));
		await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));

		expect(probe("titles")).toContain("Commented");
		expect(onClose).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Delete" }));

		const alert = await screen.findByRole("alertdialog", { name: "Delete ticket?" });

		expect(within(alert).getByText("This removes the ticket on every device.")).toBeDefined();

		await user.click(within(alert).getByRole("button", { name: "Delete" }));

		expect(probe("titles")).not.toContain("Commented");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("posts a comment with Mod+Enter", async () => {
		await setup("commented");

		const comments = screen.getByRole("region", { name: "Comments" });
		const composer = screen.getByRole("textbox", { name: "Write a comment…" });

		await user.type(composer, `  ${ctrlEnter}`);

		expect(within(comments).getAllByRole("article")).toHaveLength(1);

		await user.clear(composer);
		await user.type(composer, `Ship it${ctrlEnter}`);

		expect(within(comments).getByText("Ship it")).toBeDefined();
		expect(composer).toHaveProperty("value", "");
		expect(document.activeElement).toBe(composer);
	});

	it("explains how to post a comment", async () => {
		await setup("commented");

		const composer = screen.getByRole("textbox", { name: "Write a comment…" });
		const hint = screen.getByText("Ctrl+↵ to post");

		expect(hint.id).not.toBe("");
		expect(composer.getAttribute("aria-describedby")).toBe(hint.id);
	});

	it("closes when the ticket is deleted elsewhere", async () => {
		const { onClose } = await setup("commented");

		await user.type(title(), " draft");
		await act(async () =>
			store.mutate((data) => {
				data.tickets = data.tickets.filter((entry) => entry.id !== "commented");
			}),
		);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("opens an unknown ticket as a new one", async () => {
		const { onClose } = await setup("missing");

		expect(title()).toHaveProperty("value", "");
		expect(screen.getByRole("button", { name: "Create ticket" })).toBeDefined();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("seeds a new ticket from the initial draft", async () => {
		await setup(undefined, { assignee: "ann", labels: ["bug"] });

		expect(screen.getByRole("combobox", { name: "Assignee" }).textContent).toBe("Ann");
		expect(screen.getByRole("button", { name: "Remove bug" })).toBeDefined();

		await user.type(title(), "Seeded");
		await user.click(screen.getByRole("button", { name: "Create ticket" }));

		expect(probe("labels")).toBe(",bug");
	});

	describe("responsive layout", () => {
		const displayClasses = (element: Element | null | undefined) =>
			[...(element?.classList ?? [])].filter((name) => /^(md:)?rt-r-display-/.test(name));

		const labelInputDisplay = () =>
			displayClasses(screen.getByRole("textbox", { name: "Labels" }).closest(".rt-TextFieldRoot")?.parentElement);

		it("renders every field once in reading order: title, properties, then description and comments", async () => {
			const { dialog } = await setup("commented");
			const fields = [
				title(),
				screen.getByRole("combobox", { name: "Status" }),
				screen.getByRole("combobox", { name: "Assignee" }),
				screen.getByRole("textbox", { name: "Labels" }),
				description(),
				screen.getByRole("textbox", { name: "Write a comment…" }),
			];

			expect(
				within(dialog)
					.getAllByText(/^(Title|Status|Assignee|Labels|Description|Comments · 1)$/)
					.map((label) => label.textContent),
			).toStrictEqual(["Title", "Status", "Assignee", "Labels", "Description", "Comments · 1"]);
			expect(
				fields.every(
					(field, index) =>
						index === 0 ||
						Boolean(fields[index - 1]?.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING),
				),
			).toBe(true);
			expect(screen.getAllByRole("textbox")).toHaveLength(4);
		});

		it("renders the mobile and the desktop header, each hidden on the other layout", async () => {
			await setup("commented");

			const back = screen.getByRole("button", { name: "Back" });
			const closeIcon = screen.getByRole("button", { name: "Close ticket" });

			expect(screen.getAllByText("#comm")).toHaveLength(2);
			expect(displayClasses(back.closest(".rt-Flex"))).toStrictEqual(["rt-r-display-flex", "md:rt-r-display-none"]);
			expect(displayClasses(closeIcon?.closest(".rt-Box"))).toStrictEqual([
				"rt-r-display-none",
				"md:rt-r-display-block",
			]);
		});

		it("reveals the label input below md from + Add label, keeping it open until Escape", async () => {
			const { onClose } = await setup("commented");

			expect(labelInputDisplay()).toStrictEqual(["rt-r-display-none", "md:rt-r-display-block"]);

			await user.click(screen.getByRole("button", { name: "Add label" }));

			const input = screen.getByRole("textbox", { name: "Labels" });

			expect(labelInputDisplay()).toStrictEqual(["rt-r-display-block", "md:rt-r-display-block"]);
			expect(document.activeElement).toBe(input);

			await user.type(input, "bug{Enter}");

			expect(probe("labels")).toBe("bug");
			expect(screen.getByRole("button", { name: "Remove bug" })).toBeDefined();
			expect(document.activeElement).toBe(input);
			expect(input).toHaveProperty("value", "");

			await user.keyboard("{Escape}");

			expect(labelInputDisplay()).toStrictEqual(["rt-r-display-none", "md:rt-r-display-block"]);
			expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add label" }));
			expect(onClose).not.toHaveBeenCalled();
		});

		it("hides an empty revealed label input on blur", async () => {
			await setup("commented");

			await user.click(screen.getByRole("button", { name: "Add label" }));

			expect(labelInputDisplay()).toStrictEqual(["rt-r-display-block", "md:rt-r-display-block"]);

			await user.click(title());

			expect(labelInputDisplay()).toStrictEqual(["rt-r-display-none", "md:rt-r-display-block"]);
		});

		it("saves typed text and closes on Back", async () => {
			const { onClose } = await setup("commented");

			await user.type(description(), "Typed");
			await user.click(screen.getByRole("button", { name: "Back" }));

			expect(store.query((data) => data.tickets[0]?.description)).toBe("Typed");
			expect(onClose).toHaveBeenCalledOnce();
		});
	});
});
