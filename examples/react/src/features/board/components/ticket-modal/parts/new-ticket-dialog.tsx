import type { Link } from "example-schema";
import { type SubmitEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useMutation } from "@/store";

import { type PropertyChange, TicketFields, type TicketDraft, type TicketProperties } from "./fields";
import { TicketDialogShell } from "./ticket-dialog-shell";

interface NewTicketDialogProps {
	boardId: string;
	boardName: string;
	initial?: Partial<TicketDraft>;
	onClose: () => void;
}

/** Shows a form for a new ticket in a dialog and creates the ticket on the board on submit. */
export const NewTicketDialog = ({ boardId, boardName, initial, onClose }: NewTicketDialogProps) => {
	const { t } = useTranslation();
	const mutate = useMutation();
	const defaults: TicketDraft = {
		title: "",
		description: "",
		status: "backlog",
		priority: "low",
		assignee: "",
		labels: [],
		...initial,
	};
	const form = useForm<TicketDraft>({ defaultValues: defaults });
	const [properties, setProperties] = useState<TicketProperties>({
		status: defaults.status,
		priority: defaults.priority,
		assignee: defaults.assignee,
		labels: defaults.labels,
	});
	const [links, setLinks] = useState<Link[]>([]);

	const create = form.handleSubmit((texts) => {
		mutate((data) => {
			data.boards
				.find((board) => board.id === boardId)
				?.tickets.push({
					...texts,
					...properties,
					title: texts.title.trim(),
					id: crypto.randomUUID(),
					comments: [],
					links,
				});
		});
		onClose();
	});

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => void create(event);

	const handleChange: PropertyChange = (patch) => setProperties((current) => ({ ...current, ...patch }));

	const handleAddLink = (link: Link) => setLinks((current) => [...current, link]);

	const handleRemoveLink = (id: string) => setLinks((current) => current.filter((link) => link.id !== id));

	return (
		<TicketDialogShell boardName={boardName} title={t("newTicket")} onSubmit={handleSubmit} onClose={onClose}>
			<TicketFields
				form={form}
				properties={properties}
				onChange={handleChange}
				links={links}
				onAddLink={handleAddLink}
				onRemoveLink={handleRemoveLink}
				autoFocus
			/>
		</TicketDialogShell>
	);
};
