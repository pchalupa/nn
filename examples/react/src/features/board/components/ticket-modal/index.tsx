import { type Ref, useImperativeHandle, useState } from "react";

import type { TicketDraft } from "./parts/fields";
import { TicketDialog } from "./parts/ticket-dialog";

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

/** Shows the ticket with `id`, or a new ticket once `open` is called through `ref`, until the modal closes. */
export const TicketModal = ({ ref, id, onClose }: TicketModalProps) => {
	const [draft, setDraft] = useState<Partial<TicketDraft>>();

	useImperativeHandle(ref, () => ({ open: (initial = {}) => setDraft(initial) }), []);

	const handleClose = () => {
		setDraft(undefined);
		onClose?.();
	};

	if (id !== undefined) return <TicketDialog id={id} onClose={handleClose} />;

	if (draft) return <TicketDialog initial={draft} onClose={handleClose} />;

	return null;
};
