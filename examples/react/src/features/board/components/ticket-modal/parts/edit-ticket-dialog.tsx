import type { Link, Ticket } from "example-schema";
import { type SubmitEvent, useEffect, useEffectEvent } from "react";
import { useForm } from "react-hook-form";

import { ticketKey } from "@/features/board/ticket-key";
import { useMutation, useQuery } from "@/store";

import { Comments } from "./comments";
import { type PropertyChange, type TextFieldName, TicketFields, type TicketDraft } from "./fields";
import { TicketDialogShell } from "./ticket-dialog-shell";

interface EditTicketDialogProps {
	id: string;
	onClose: () => void;
}

/** Shows a saved ticket in a dialog that saves each edit as it happens. */
export const EditTicketDialog = ({ id, onClose }: EditTicketDialogProps) => {
	const ticket = useQuery((data) => {
		const entry = data.tickets.find((item) => item.id === id);

		if (entry) {
			return {
				title: entry.title,
				description: entry.description,
				status: entry.status,
				assignee: entry.assignee,
				labels: [...entry.labels],
			};
		}
	});
	const links = useQuery(
		(data) =>
			data.tickets
				.find((item) => item.id === id)
				?.links.map((link) => ({ id: link.id, url: link.url, title: link.title })) ?? [],
	);
	const mutate = useMutation();
	const form = useForm<TicketDraft>({ values: ticket, resetOptions: { keepDirtyValues: true } });

	const update = (change: (item: Ticket) => void) =>
		mutate((data) => {
			const item = data.tickets.find((entry) => entry.id === id);

			if (item) change(item);
		});

	const saveText = (name: TextFieldName) => {
		if (!form.getFieldState(name).isDirty) return;

		let value = form.getValues(name);

		if (name === "title") {
			value = value.trim();

			if (value === "") {
				form.resetField(name);

				return;
			}
		}

		update((item) => {
			if (item[name] !== value) item[name] = value;
		});
		form.resetField(name, { defaultValue: value });
	};

	const saveTexts = () => {
		saveText("title");
		saveText("description");
	};

	const saveOnUnmount = useEffectEvent(saveTexts);

	useEffect(() => () => saveOnUnmount(), []);

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault();
		saveTexts();
	};

	const handleClose = () => {
		saveTexts();
		onClose();
	};

	const handleChange: PropertyChange = (patch) => update((item) => Object.assign(item, patch));

	const handleAddLink = (link: Link) => update((item) => item.links.push(link));

	const handleRemoveLink = (linkId: string) =>
		update((item) => {
			item.links = item.links.filter((link) => link.id !== linkId);
		});

	const handleDelete = () =>
		mutate((data) => {
			data.tickets = data.tickets.filter((entry) => entry.id !== id);
		});

	if (!ticket) return null;

	return (
		<TicketDialogShell
			title={ticket.title}
			ticketKey={ticketKey(id)}
			onSubmit={handleSubmit}
			onClose={handleClose}
			onDelete={handleDelete}
		>
			<TicketFields
				form={form}
				properties={ticket}
				onChange={handleChange}
				links={links}
				onAddLink={handleAddLink}
				onRemoveLink={handleRemoveLink}
				onTextBlur={saveText}
			>
				<Comments ticketId={id} />
			</TicketFields>
		</TicketDialogShell>
	);
};
