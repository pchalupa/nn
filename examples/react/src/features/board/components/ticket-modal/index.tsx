import { type Ref, useEffect, useEffectEvent, useImperativeHandle, useState } from "react";

import { useQuery } from "@/store";

import { EditTicketDialog } from "./parts/edit-ticket-dialog";
import type { TicketDraft } from "./parts/fields";
import { NewTicketDialog } from "./parts/new-ticket-dialog";

/** Controls a ticket modal from its parent. */
export interface TicketModalHandle {
	/** Opens the modal on a new ticket seeded from the draft. */
	open: (initial?: Partial<TicketDraft>) => void;
}

interface TicketModalProps {
	ref?: Ref<TicketModalHandle>;
	id?: string;
	onClose?: () => void;
}

/** Shows the ticket with `id`, a new ticket form for an unknown `id`, or a new ticket once `open` is called through `ref`, until the modal closes or the shown ticket is deleted. */
export const TicketModal = ({ ref, id, onClose }: TicketModalProps) => {
	const [draft, setDraft] = useState<Partial<TicketDraft>>();
	const [seen, setSeen] = useState(false);
	const exists = useQuery((data) => data.tickets.some((ticket) => ticket.id === id));
	const deleted = seen && !exists;

	if (exists && !seen) setSeen(true);

	useImperativeHandle(ref, () => ({ open: (initial = {}) => setDraft(initial) }), []);

	const handleClose = () => {
		setDraft(undefined);
		onClose?.();
	};

	const closeDeleted = useEffectEvent(() => onClose?.());

	useEffect(() => {
		if (deleted) closeDeleted();
	}, [deleted]);

	if (deleted) return null;

	if (id !== undefined && exists) return <EditTicketDialog id={id} onClose={handleClose} />;

	if (id !== undefined) return <NewTicketDialog onClose={handleClose} />;

	if (draft) return <NewTicketDialog initial={draft} onClose={handleClose} />;

	return null;
};
