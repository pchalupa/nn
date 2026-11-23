import { type SubmitEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useMutation } from "@/store";

import { type PropertyChange, TicketFields, type TicketDraft, type TicketProperties } from "./fields";
import { TicketDialogShell } from "./ticket-dialog-shell";

const emptyDraft: TicketDraft = { title: "", description: "", status: "backlog", assignee: "", labels: [] };

interface NewTicketDialogProps {
	initial?: Partial<TicketDraft>;
	onClose: () => void;
}

/** Shows a form for a new ticket in a dialog and creates the ticket on submit. */
export const NewTicketDialog = ({ initial, onClose }: NewTicketDialogProps) => {
	const { t } = useTranslation();
	const mutate = useMutation();
	const defaults = { ...emptyDraft, ...initial };
	const form = useForm<TicketDraft>({ defaultValues: defaults });
	const [properties, setProperties] = useState<TicketProperties>({
		status: defaults.status,
		assignee: defaults.assignee,
		labels: defaults.labels,
	});

	const create = form.handleSubmit((texts) => {
		mutate((data) => {
			data.tickets.push({
				...texts,
				...properties,
				title: texts.title.trim(),
				id: crypto.randomUUID(),
				comments: [],
			});
		});
		onClose();
	});

	const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => void create(event);

	const handleChange: PropertyChange = (patch) => setProperties((current) => ({ ...current, ...patch }));

	return (
		<TicketDialogShell title={t("newTicket")} onSubmit={handleSubmit} onClose={onClose}>
			<TicketFields form={form} properties={properties} onChange={handleChange} autoFocus />
		</TicketDialogShell>
	);
};
